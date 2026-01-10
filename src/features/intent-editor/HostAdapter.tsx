import React, { useEffect, useRef, useState, useMemo } from 'react';
import EditorHeader from '../../components/common/EditorHeader';
import { getTaskVisualsByType } from '../../components/Flowchart/utils/taskVisuals';
import EmbeddingEditorShell, { EmbeddingEditorShellRef } from './EmbeddingEditorShell';
import { useIntentStore } from './state/intentStore';
import { useTestStore } from './state/testStore';
import type { ProblemPayload, ProblemIntent, ProblemEditorState } from '../../types/project';
import { ProjectDataService } from '../../services/ProjectDataService';
import { taskRepository } from '../../services/TaskRepository';
import { Brain, Loader2 } from 'lucide-react';
import type { EditorProps } from '../../components/TaskEditor/EditorHost/types'; // ✅ ARCHITETTURA ESPERTO: Usa EditorProps invece di props custom
import type { ToolbarButton } from '../../dock/types'; // ✅ PATTERN CENTRALIZZATO: Import per toolbar

function toEditorState(payload?: ProblemPayload) {
  const intents = (payload?.intents || []).map((pi: ProblemIntent) => ({
    id: pi.id,
    name: pi.name,
    langs: ['it'],
    threshold: pi.threshold ?? 0.6,
    status: 'draft',
    variants: {
      curated: (pi.phrases?.matching || []).map(p => ({ id: p.id, text: p.text, lang: (p.lang as any) || 'it' })),
      staging: [],
      hardNeg: (pi.phrases?.notMatching || []).map(p => ({ id: p.id, text: p.text, lang: (p.lang as any) || 'it' })),
    },
    signals: { keywords: (pi.phrases?.keywords || []), synonymSets: [], patterns: [] },
  }));
  const tests = (payload?.editor?.tests || []).map(t => ({ id: t.id, text: t.text, status: t.status }));
  return { intents, tests };
}

function fromEditorState(): ProblemPayload {
  const intents = useIntentStore.getState().intents;
  const tests = useTestStore.getState().items;
  const outIntents: ProblemIntent[] = intents.map(it => ({
    id: it.id,
    name: it.name,
    threshold: it.threshold,
    phrases: {
      matching: it.variants.curated.map(v => ({ id: v.id, text: v.text, lang: v.lang as any })),
      notMatching: it.variants.hardNeg.map(v => ({ id: v.id, text: v.text, lang: v.lang as any })),
      keywords: it.signals.keywords,
    }
  }));
  const editor: ProblemEditorState = { tests: tests.map(t => ({ id: t.id, text: t.text, status: t.status })) };
  return { version: 1, intents: outIntents, editor };
}

export default function IntentHostAdapter({ task, onClose, hideHeader, onToolbarUpdate }: EditorProps) { // ✅ PATTERN CENTRALIZZATO: Accetta hideHeader e onToolbarUpdate
  // ✅ ARCHITETTURA ESPERTO: Gestisci task undefined/null
  if (!task) {
    console.error('❌ [IntentHostAdapter] Task is undefined/null', { task });
    return (
      <div className="h-full w-full bg-red-900 text-white p-4 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Errore</h2>
          <p>Task non disponibile</p>
        </div>
      </div>
    );
  }

  // ✅ ARCHITETTURA ESPERTO: Usa task invece di act
  const instanceId = task.instanceId || task.id;

  // Hydrate from task (load problem payload from TaskRepository or localStorage)
  useEffect(() => {
    const pid = (() => { try { return localStorage.getItem('current.projectId') || ''; } catch { return ''; } })();
    const key = `problem.${pid}.${instanceId}`;

    // ✅ ARCHITETTURA ESPERTO: Carica problem payload dal Task se disponibile
    const taskInstance = taskRepository.getTask(instanceId);
    const payload: ProblemPayload | undefined = (taskInstance as any)?.problem || ((): any => {
      try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : undefined; } catch { return undefined; }
    })();
    const { intents, tests } = toEditorState(payload);
    useIntentStore.setState({ intents });
    useTestStore.setState({ items: tests } as any);

    // FASE 6D: Update TaskRepository with current intents
    try {
      if (instanceId) {
        const pid = (() => { try { return localStorage.getItem('current.projectId') || ''; } catch { return ''; } })();
        const problemIntents = fromEditorState().intents.map(it => ({
          id: it.id,
          name: it.name,
          threshold: it.threshold,
          phrases: it.phrases
        }));
        taskRepository.updateTask(instanceId, { intents: problemIntents }, pid || undefined);
      }
    } catch (err) {
      console.warn('[IntentEditor] Could not update TaskRepository:', err);
    }

    // Debounced persist back to task shadow (local only; actual write to task model should be done by host when available)
    let t: any;
    const unsubA = useIntentStore.subscribe(() => {
      clearTimeout(t); t = setTimeout(() => {
        try {
          const next = fromEditorState();
          localStorage.setItem(key, JSON.stringify(next));
          // Also reflect into in-memory project graph so explicit Save includes it
          try { ProjectDataService.setTaskTemplateProblemById(task.id, next); } catch { } // ✅ ARCHITETTURA ESPERTO: Usa task.id invece di props.act.id

          // FASE 6D: Update TaskRepository when intents change
          try {
            const pid = (() => { try { return localStorage.getItem('current.projectId') || ''; } catch { return ''; } })();
            console.log('[IntentEditor][SAVE][DEBOUNCED]', {
              taskId: task.id, // ✅ ARCHITETTURA ESPERTO: Usa task.id
              instanceId: instanceId || 'NOT_FOUND',
              intentsCount: next.intents.length,
              intents: next.intents.map(it => ({
                id: it.id,
                name: it.name,
                threshold: it.threshold,
                matchingCount: it.phrases?.matching?.length || 0,
                notMatchingCount: it.phrases?.notMatching?.length || 0,
                keywordsCount: it.phrases?.keywords?.length || 0
              }))
            });

            if (instanceId) {
              const problemIntents = next.intents.map(it => ({
                id: it.id,
                name: it.name,
                threshold: it.threshold,
                phrases: it.phrases
              }));

              console.log('[IntentEditor][UPDATE_TASK_REPO][START]', {
                instanceId,
                intentsCount: problemIntents.length,
                firstIntent: problemIntents[0] ? {
                  id: problemIntents[0].id,
                  name: problemIntents[0].name,
                  matchingCount: problemIntents[0].phrases?.matching?.length || 0,
                  notMatchingCount: problemIntents[0].phrases?.notMatching?.length || 0
                } : null
              });

              taskRepository.updateTask(instanceId, { intents: problemIntents }, pid || undefined);

              console.log('[IntentEditor][UPDATE_TASK_REPO][RESULT]', {
                instanceId,
                note: 'TaskRepository updated - will be saved to DB on project save'
              });
            } else {
              console.warn('[IntentEditor][UPDATE_TASK_REPO][SKIP]', {
                taskId: task.id, // ✅ ARCHITETTURA ESPERTO: Usa task.id
                reason: 'instanceId not found in task',
                taskKeys: Object.keys(task)
              });
            }
          } catch (err) {
            console.error('[IntentEditor][UPDATE_TASK_REPO][ERROR]', {
              taskId: task.id, // ✅ ARCHITETTURA ESPERTO: Usa task.id
              error: String(err),
              stack: err?.stack?.substring(0, 200)
            });
          }
        } catch { }
      }, 700);
    });
    const unsubB = useTestStore.subscribe(() => {
      clearTimeout(t); t = setTimeout(() => {
        try {
          const next = fromEditorState();
          localStorage.setItem(key, JSON.stringify(next));
          try { ProjectDataService.setTaskTemplateProblemById(task.id, next); } catch { } // ✅ ARCHITETTURA ESPERTO: Usa task.id

          // FASE 6D: Update TaskRepository when tests change (which might affect intents)
          try {
            if (instanceId) {
              const pid = (() => { try { return localStorage.getItem('current.projectId') || ''; } catch { return ''; } })();
              const problemIntents = next.intents.map(it => ({
                id: it.id,
                name: it.name,
                threshold: it.threshold,
                phrases: it.phrases
              }));
              taskRepository.updateTask(instanceId, { intents: problemIntents }, pid || undefined);
            }
          } catch (err) {
            console.warn('[IntentEditor] Could not update TaskRepository:', err);
          }
        } catch { }
      }, 700);
    });
    return () => { unsubA(); unsubB(); clearTimeout(t); };
  }, [instanceId, task.id]); // ✅ ARCHITETTURA ESPERTO: Usa instanceId e task.id invece di props.act?.id
  // ✅ ARCHITETTURA ESPERTO: Usa task.type invece di props.act?.type
  const taskType = task.type ?? 5; // Default a ClassifyProblem se type non è definito
  const { Icon, color } = getTaskVisualsByType(taskType, true);

  const editorRef = useRef<EmbeddingEditorShellRef>(null);
  const [trainState, setTrainState] = useState({ training: false, modelReady: false, canTrain: false });

  // ✅ PATTERN CENTRALIZZATO: Toolbar buttons (come BackendCallEditor e ResponseEditor)
  const toolbarButtons = useMemo<ToolbarButton[]>(() => {
    return [
      {
        icon: trainState.training ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />,
        label: trainState.training ? 'Training...' : 'Train Model',
        onClick: () => editorRef.current?.handleTrain(),
        title: trainState.training ? 'Training in corso...' : trainState.modelReady ? 'Model ready - Click to retrain' : 'Train embeddings model',
        disabled: !trainState.canTrain || trainState.training
      }
    ];
  }, [trainState.training, trainState.modelReady, trainState.canTrain]);

  // ✅ PATTERN CENTRALIZZATO: Update toolbar quando cambia (per docking mode)
  const headerColor = '#f59e0b'; // Orange color for ClassifyProblem
  React.useEffect(() => {
    if (hideHeader && onToolbarUpdate) {
      onToolbarUpdate(toolbarButtons, headerColor);
    }
  }, [hideHeader, toolbarButtons, onToolbarUpdate, headerColor]);

  // ✅ SOLUZIONE ESPERTO: Rimuovere tutti i ResizeObserver e log di debug, usare solo flex-1 min-h-0
  return (
    <div className="w-full flex flex-col flex-1 min-h-0">
      {/* ✅ PATTERN CENTRALIZZATO: Mostra EditorHeader solo se hideHeader è false */}
      {!hideHeader && (
      <EditorHeader
        icon={<Icon size={18} style={{ color }} />}
          title={String(task?.label || 'Problem')} // ✅ ARCHITETTURA ESPERTO: Usa task.label
        color="orange"
          onClose={onClose} // ✅ ARCHITETTURA ESPERTO: Usa onClose da EditorProps
          toolbarButtons={toolbarButtons} // ✅ PATTERN CENTRALIZZATO: Toolbar incorporata nell'header
        />
      )}
      {/* ✅ SOLUZIONE ESPERTO: Usa flex-1 min-h-0 per propagare correttamente l'altezza */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <EmbeddingEditorShell
          ref={editorRef}
          instanceId={instanceId} // ✅ ARCHITETTURA ESPERTO: Usa instanceId già calcolato
          onTrainStateChange={setTrainState}
          // ✅ FIX DOPPIO HEADER: Passa training state per mostrare Train Model button nei controlli
          training={trainState.training}
          modelReady={trainState.modelReady}
          canTrain={trainState.canTrain}
        />
      </div>
    </div>
  );
}


