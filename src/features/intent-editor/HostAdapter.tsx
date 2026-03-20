import React, { useEffect, useRef, useState, useMemo } from 'react';
import { getTaskVisualsByType } from '../../components/Flowchart/utils/taskVisuals';
import EmbeddingEditorShell, { EmbeddingEditorShellRef } from './EmbeddingEditorShell';
import { useIntentStore } from './state/intentStore';
import { useTestStore } from './state/testStore';
import type { ProblemPayload, ProblemIntent, ProblemEditorState } from '../../types/project';
import { ProjectDataService } from '../../services/ProjectDataService';
import { taskRepository } from '../../services/TaskRepository';
import {
  normalizeProblemPayload,
  problemIntentsToSemanticValues,
  semanticValuesToProblemIntents,
} from '../../utils/semanticValueClassificationBridge';
import { Brain, Loader2 } from 'lucide-react';
import type { EditorProps } from '../../components/TaskEditor/EditorHost/types'; // ✅ ARCHITETTURA ESPERTO: Usa EditorProps invece di props custom
import type { ToolbarButton } from '../../dock/types'; // ✅ PATTERN CENTRALIZZATO: Import per toolbar
import { useHeaderToolbarContext } from '../../components/TaskEditor/ResponseEditor/context/HeaderToolbarContext';

function toEditorState(payload: ProblemPayload) {
  const piList = semanticValuesToProblemIntents(payload.semanticValues);
  const intents = piList.map((pi: ProblemIntent) => ({
    id: pi.id,
    name: pi.name,
    langs: ['it'],
    threshold: pi.threshold ?? 0.6,
    status: 'draft' as const,
    variants: {
      curated: (pi.phrases?.matching || []).map(p => ({ id: p.id, text: p.text, lang: (p.lang as any) || 'it' })),
      staging: [],
      hardNeg: (pi.phrases?.notMatching || []).map(p => ({ id: p.id, text: p.text, lang: (p.lang as any) || 'it' })),
    },
    signals: { keywords: (pi.phrases?.keywords || []), synonymSets: [], patterns: [] },
  }));
  const tests = (payload.editor?.tests || []).map(t => ({ id: t.id, text: t.text, status: t.status }));
  return { intents, tests };
}

function fromEditorState(instanceId: string): ProblemPayload {
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
  const prev = taskRepository.getTask(instanceId)?.semanticValues;
  const semanticValues = problemIntentsToSemanticValues(outIntents, prev ?? null);
  const editor: ProblemEditorState = { tests: tests.map(t => ({ id: t.id, text: t.text, status: t.status })) };
  return { version: 1, semanticValues, editor };
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
    const pid = (() => { try { return localStorage.getItem('currentProjectId') || ''; } catch { return ''; } })();
    const key = `problem.${pid}.${instanceId}`;

    const taskInstance = taskRepository.getTask(instanceId);
    const parts: Record<string, unknown> = { version: 1 };
    if (taskInstance?.semanticValues && Array.isArray(taskInstance.semanticValues)) {
      parts.semanticValues = taskInstance.semanticValues;
    }
    if ((taskInstance as any)?.problem) {
      const p = normalizeProblemPayload((taskInstance as any).problem);
      if (!(parts.semanticValues as any[])?.length && p.semanticValues?.length) {
        parts.semanticValues = p.semanticValues;
      }
      parts.editor = p.editor;
    }
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const ls = normalizeProblemPayload(JSON.parse(raw));
        if (!(parts.semanticValues as any[])?.length && ls.semanticValues?.length) {
          parts.semanticValues = ls.semanticValues;
        }
        parts.editor = (parts.editor as ProblemEditorState) ?? ls.editor;
      }
    } catch { /* ignore */ }

    const payload = normalizeProblemPayload(parts);
    const { intents, tests } = toEditorState(payload);
    useIntentStore.setState({ intents });
    useTestStore.setState({ items: tests } as any);

    try {
      if (instanceId) {
        const pid = (() => { try { return localStorage.getItem('currentProjectId') || ''; } catch { return ''; } })();
        const next = fromEditorState(instanceId);
        taskRepository.updateTask(instanceId, { semanticValues: next.semanticValues }, pid || undefined);
      }
    } catch (err) {
      console.warn('[IntentEditor] Could not update TaskRepository:', err);
    }

    // Debounced persist back to task shadow (local only; actual write to task model should be done by host when available)
    let t: any;
    const unsubA = useIntentStore.subscribe(() => {
      clearTimeout(t); t = setTimeout(() => {
        try {
          const next = fromEditorState(instanceId);
          localStorage.setItem(key, JSON.stringify(next));
          try { ProjectDataService.setTaskTemplateProblemById(task.id, next); } catch { }

          try {
            const pid = (() => { try { return localStorage.getItem('currentProjectId') || ''; } catch { return ''; } })();
            if (instanceId) {
              taskRepository.updateTask(instanceId, { semanticValues: next.semanticValues }, pid || undefined);
            }
          } catch (err) {
            console.error('[IntentEditor][UPDATE_TASK_REPO][ERROR]', {
              taskId: task.id,
              error: String(err),
              stack: err instanceof Error ? err.stack?.substring(0, 200) : undefined
            });
          }
        } catch { }
      }, 700);
    });
    const unsubB = useTestStore.subscribe(() => {
      clearTimeout(t); t = setTimeout(() => {
        try {
          const next = fromEditorState(instanceId);
          localStorage.setItem(key, JSON.stringify(next));
          try { ProjectDataService.setTaskTemplateProblemById(task.id, next); } catch { }

          try {
            if (instanceId) {
              const pid = (() => { try { return localStorage.getItem('currentProjectId') || ''; } catch { return ''; } })();
              taskRepository.updateTask(instanceId, { semanticValues: next.semanticValues }, pid || undefined);
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
  // ✅ TODO FUTURO: Category System (vedi documentation/TODO_NUOVO.md)
  // Aggiornare per usare getTaskVisuals(taskType, task?.category, task?.categoryCustom, true)
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

  // ✅ ARCHITECTURE: Inject icon and title into main header (no local header)
  const headerContext = useHeaderToolbarContext();
  React.useEffect(() => {
    if (headerContext) {
      // Inject icon and title into main header
      headerContext.setIcon(<Icon size={18} style={{ color }} />);
      headerContext.setTitle(String(task?.label || 'Problem'));

      return () => {
        // Cleanup: remove injected values when editor unmounts
        headerContext.setIcon(null);
        headerContext.setTitle(null);
      };
    }
  }, [headerContext, task?.label, Icon, color]);

  // ✅ SOLUZIONE ESPERTO: Rimuovere tutti i ResizeObserver e log di debug, usare solo flex-1 min-h-0
  return (
    <div className="w-full flex flex-col flex-1 min-h-0">
      {/* ✅ ARCHITECTURE: No local header - icon/title/toolbar are injected into main header */}
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


