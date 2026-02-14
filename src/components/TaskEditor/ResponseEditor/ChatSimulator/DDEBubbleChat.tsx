import React from 'react';
import type { Task, TaskTree } from '@types/taskTypes';
import { AlertTriangle } from 'lucide-react';
import UserMessage, { type Message } from '@components/ChatSimulator/UserMessage';
import BotMessage from '@responseEditor/ChatSimulator/BotMessage';
import { getStepColor } from '@responseEditor/ChatSimulator/chatSimulatorUtils';
import { useFontContext } from '@context/FontContext';
import { useMessageEditing } from '@responseEditor/ChatSimulator/hooks/useMessageEditing';
import DialogueTaskService from '@services/DialogueTaskService';
import { v4 as uuidv4 } from 'uuid';
import { useProjectTranslations } from '@context/ProjectTranslationsContext';

export default function DDEBubbleChat({
  task,
  projectId,
  translations,
  taskTree,
  onUpdateTaskTree,
  // ✅ NEW: Preview mode props (optional, default = 'interactive')
  mode = 'interactive',
  previewMessages,
  activeScenario,
  onScenarioChange,
}: {
  task: Task | null;
  projectId: string | null;
  translations?: Record<string, string>;
  taskTree?: TaskTree | null;
  onUpdateTaskTree?: (updater: (taskTree: any) => any) => void;
  // ✅ NEW: Preview mode props
  mode?: 'interactive' | 'preview';
  previewMessages?: Message[];
  activeScenario?: 'happy' | 'partial' | 'error';
  onScenarioChange?: (scenario: 'happy' | 'partial' | 'error') => void;
}) {
  const { combinedClass, fontSize } = useFontContext();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [backendError, setBackendError] = React.useState<string | null>(null);
  const [isWaitingForInput, setIsWaitingForInput] = React.useState(false);
  const [resetCounter, setResetCounter] = React.useState(0); // ✅ Counter per forzare riavvio dopo reset
  const eventSourceRef = React.useRef<EventSource | null>(null);
  const sentTextRef = React.useRef<string>('');
  const sessionStartingRef = React.useRef<boolean>(false);
  const lastSessionKeyRef = React.useRef<string | null>(null);

  // Message ID generator
  const messageIdCounter = React.useRef(0);
  const generateMessageId = (prefix: string = 'msg') => {
    messageIdCounter.current += 1;
    return `${prefix}-${Date.now()}-${messageIdCounter.current}`;
  };

  // Message editing state and handlers
  // TODO: Update useMessageEditing to work with TaskTree instead of AssembledDDT
  const {
    hoveredId,
    setHoveredId,
    editingId,
    draftText,
    inlineDraft,
    setInlineDraft,
    scrollContainerRef,
    inlineInputRef,
    ensureInlineFocus,
    handleEdit,
    handleSave,
    handleCancel
  } = useMessageEditing({
    messages,
    setMessages,
    currentDDT: null as any, // TODO: Remove when useMessageEditing is updated
    onUpdateDDT: onUpdateTaskTree as any // TODO: Update when useMessageEditing is updated
  });

  // ✅ NEW: In preview mode, use previewMessages instead of SSE
  const displayMessages = mode === 'preview' && previewMessages ? previewMessages : messages;

  // Connect to backend via SSE
  // ❌ CRITICAL: NO frontend dialogue logic - ALL messages come from backend via SSE
  // If backend is not reachable, NO messages should be shown, NO dialogue should start
  // ✅ NEW: Skip SSE in preview mode
  React.useEffect(() => {
    // ✅ NEW: Preview mode - no SSE, use previewMessages
    if (mode === 'preview') {
      // Clear any existing SSE state
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setBackendError(null);
      setIsWaitingForInput(false);
      sessionStartingRef.current = false;
      lastSessionKeyRef.current = null;
      return;
    }

    // ✅ EXISTING: Interactive mode - normal behavior (unchanged)
    if (!task || !projectId || !task.id) {
      // Clear messages when task is not available - NO frontend logic
      setMessages([]);
      setBackendError(null);
      setIsWaitingForInput(false);
      sessionStartingRef.current = false;
      lastSessionKeyRef.current = null;
      return;
    }

    // ✅ Create a unique key for this task/project combination
    const sessionKey = `${task.id}-${projectId}`;

    // ✅ Prevent duplicate session starts for the same task/project combination
    if (lastSessionKeyRef.current === sessionKey) {
      return;
    }

    lastSessionKeyRef.current = sessionKey;

    // ✅ Prevent multiple simultaneous session starts
    if (sessionStartingRef.current) {
      return;
    }

    // ✅ Mark this combination as started
    lastSessionKeyRef.current = sessionKey;

    // Clear any existing messages when starting a new session - NO frontend logic
    setMessages([]);
    messageIdCounter.current = 0;
    setBackendError(null);
    setIsWaitingForInput(false);
    sessionStartingRef.current = true;

    const baseUrl = 'http://localhost:5000'; // ✅ VB.NET backend diretto

    const startSession = async () => {
      try {
        setBackendError(null);
        const translationsData = translations || {};

        console.log('[DDEBubbleChat] 🔍 Translations check before sending', {
          hasTranslations: !!translations,
          translationsCount: translations ? Object.keys(translations).length : 0,
          translationsDataCount: Object.keys(translationsData).length,
          hasTaskTree: !!taskTree,
          taskTreeStepsKeys: taskTree?.steps ? Object.keys(taskTree.steps) : [],
          taskTreeNodesCount: taskTree?.nodes?.length || 0,
          sampleTranslations: Object.entries(translationsData).slice(0, 5).map(([k, v]) => ({ guid: k, text: String(v).substring(0, 50) }))
        });

        // ✅ Safety check: Log if translations are empty (for debugging multi-data tasks)
        if (Object.keys(translationsData).length === 0) {
          console.error('[DDEBubbleChat] ❌ Translations empty before sending', {
            hasTranslations: !!translations,
            translationsCount: translations ? Object.keys(translations).length : 0,
            hasTaskTree: !!taskTree,
            taskTreeStepsKeys: taskTree?.steps ? Object.keys(taskTree.steps) : [],
            taskTreeNodesCount: taskTree?.nodes?.length || 0,
            taskTreeNodes: taskTree?.nodes?.map((n: any) => ({
              id: n.id,
              templateId: n.templateId,
              label: n.label,
              hasSubNodes: !!(n.subNodes && n.subNodes.length > 0),
              subNodesCount: n.subNodes?.length || 0
            })) || []
          });
        }

        // ✅ CRITICAL: TaskTree è OBBLIGATORIO - non inviare solo taskId
        if (!taskTree) {
          throw new Error('[DDEBubbleChat] TaskTree is required. Cannot start session without complete instance.');
        }

        console.log('[DDEBubbleChat] 📋 STEP 1: Loading project metadata...', { projectId });

        // ✅ Recupera lingua e versione del progetto - OBBLIGATORIO, nessun fallback
        if (!projectId) {
          throw new Error('[DDEBubbleChat] ProjectId is required');
        }

        console.log(`[DDEBubbleChat] 📋 Fetching project metadata from /api/projects/${projectId}...`);
        const projectResponse = await fetch(`/api/projects/${projectId}`);
        console.log(`[DDEBubbleChat] 📋 Project metadata response status: ${projectResponse.status}`);

        if (!projectResponse.ok) {
          const errorText = await projectResponse.text();
          console.error(`[DDEBubbleChat] ❌ Failed to load project metadata: ${projectResponse.status}`, {
            status: projectResponse.status,
            statusText: projectResponse.statusText,
            error: errorText
          });
          throw new Error(`Failed to load project metadata: ${projectResponse.statusText} - ${errorText}`);
        }

        const project = await projectResponse.json();
        console.log('[DDEBubbleChat] 📋 Project metadata loaded:', {
          projectId: project._id || project.projectId,
          language: project.language,
          version: project.version,
          versionQualifier: project.versionQualifier
        });

        if (!project.language) {
          throw new Error('[DDEBubbleChat] Project language is required');
        }

        // Converti formato breve (es. 'it', 'en', 'pt') a formato completo (es. 'it-IT', 'en-US', 'pt-BR')
        const langMap: Record<string, string> = {
          'it': 'it-IT',
          'en': 'en-US',
          'pt': 'pt-BR',
          'es': 'es-ES',
          'fr': 'fr-FR'
        };
        const projectLanguage = langMap[project.language] || `${project.language}-${project.language.toUpperCase()}`;
        console.log(`[DDEBubbleChat] 📋 Mapped language: ${project.language} -> ${projectLanguage}`);

        // ✅ Recupera versione del progetto - OBBLIGATORIO
        if (!project.version) {
          throw new Error('[DDEBubbleChat] Project version is required');
        }
        const projectVersion = project.version;
        const versionQualifier = project.versionQualifier || 'production';
        // Costruisci dialogVersion: "1.0" o "1.0-alpha" se qualifier non è production
        const dialogVersion = versionQualifier !== 'production'
          ? `${projectVersion}-${versionQualifier}`
          : projectVersion;
        console.log(`[DDEBubbleChat] 📋 Dialog version: ${dialogVersion} (from version=${projectVersion}, qualifier=${versionQualifier})`);

        console.log('[DDEBubbleChat] 📋 STEP 1 COMPLETE:', { projectLanguage, dialogVersion });

        // ✅ NUOVO MODELLO: Invia TaskTree completo (working copy) invece di solo taskId
        // L'istanza in memoria è la fonte di verità, non il database
        // ✅ CRITICAL: Steps è già dictionary: { "templateId": { "start": {...}, "noMatch": {...} } }
        // Il backend VB.NET si aspetta questa struttura (stessa del database)
        const stepsDict = taskTree.steps && typeof taskTree.steps === 'object' && !Array.isArray(taskTree.steps)
          ? taskTree.steps
          : {};  // ✅ Se non è dictionary, usa vuoto (legacy format)

        console.log('[DDEBubbleChat] 📋 STEP 2: Compiling and saving dialog...', {
          projectId,
          dialogVersion,
          locale: projectLanguage,
          hasTaskTree: !!taskTree,
          hasTask: !!task
        });

        // ✅ STATELESS: STEP 2: Compila e salva il dialogo nel repository
        // Il dialogo deve essere compilato e salvato prima di avviare la sessione
        if (!task || !taskTree) {
          throw new Error('[DDEBubbleChat] Task and TaskTree are required to compile and save the dialog.');
        }

        // ✅ STEP 2.1: Compila il TaskTree in RuntimeTask
        console.log('[DDEBubbleChat] 📋 STEP 2.1: Compiling TaskTree to RuntimeTask...');

        // Converti TaskTree in formato Task per la compilazione
        const taskForCompilation = {
          id: task.id,
          templateId: task.templateId || task.id,
          type: task.type || 1, // TaskTypes.UtteranceInterpretation
          label: task.label || taskTree.label || '',
          steps: taskTree.steps || {},
          nodes: taskTree.nodes || [],
          ...task
        };

        // ✅ Raccogli template referenziati (come fa useDialogueEngine.ts)
        const referencedTemplateIds = new Set<string>();

        // Aggiungi templateId del task
        if (taskForCompilation.templateId) {
          referencedTemplateIds.add(taskForCompilation.templateId);
        }

        // Raccogli templateId ricorsivamente da subTasksIds e data nodes
        const collectTemplateIds = (nodes: any[]) => {
          if (!nodes || !Array.isArray(nodes)) return;
          nodes.forEach((node: any) => {
            if (node.templateId) {
              referencedTemplateIds.add(node.templateId);
            }
            if (node.subNodes && Array.isArray(node.subNodes)) {
              collectTemplateIds(node.subNodes);
            }
            if (node.subTasksIds && Array.isArray(node.subTasksIds)) {
              node.subTasksIds.forEach((id: string) => {
                if (id) referencedTemplateIds.add(id);
              });
            }
          });
        };

        if (taskTree.nodes) {
          collectTemplateIds(taskTree.nodes);
        }

        // Carica template referenziati da DialogueTaskService
        const referencedTemplates: any[] = [];
        referencedTemplateIds.forEach(templateId => {
          // Skip se il template è già il task stesso
          if (templateId === task.id) {
            return;
          }
          try {
            const template = DialogueTaskService.getTemplate(templateId);
            if (template) {
              referencedTemplates.push(template);
              console.log(`[DDEBubbleChat] ✅ Added referenced template: ${templateId}`);
            } else {
              console.warn(`[DDEBubbleChat] ⚠️ Referenced template not found: ${templateId}`);
            }
          } catch (error) {
            console.warn(`[DDEBubbleChat] ⚠️ Error loading template ${templateId}:`, error);
          }
        });

        // Combina task e template (come fa useDialogueEngine.ts)
        const allTasksWithTemplates = [taskForCompilation, ...referencedTemplates];

        console.log('[DDEBubbleChat] 📋 Compiling task:', {
          taskId: taskForCompilation.id,
          templateId: taskForCompilation.templateId,
          type: taskForCompilation.type,
          referencedTemplatesCount: referencedTemplates.length,
          totalTasksCount: allTasksWithTemplates.length
        });

        console.log('[DDEBubbleChat] 📋 Sending compilation request:', {
          url: `${baseUrl}/api/runtime/compile`,
          taskId: taskForCompilation.id,
          templateId: taskForCompilation.templateId,
          tasksCount: allTasksWithTemplates.length
        });

        // ✅ Crea un nodo dummy per il FlowCompiler (richiede almeno un nodo entry)
        // Il FlowCompiler si aspetta nodi con rows, dove ogni row.id corrisponde a task.id
        const dummyNode = {
          id: `dummy-node-${task.id}`,
          type: 'task',
          position: { x: 0, y: 0 },
          data: {
            label: task.label || taskTree.label || 'Chat Simulator Task',
            rows: [
              {
                id: task.id,  // ✅ row.id deve corrispondere a task.id
                taskId: task.id,
                label: task.label || taskTree.label || ''
              }
            ]
          }
        };

        // ✅ Usa /api/runtime/compile (stessa soluzione robusta di useDialogueEngine.ts)
        const compileResponse = await fetch(`${baseUrl}/api/runtime/compile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodes: [dummyNode],  // ✅ Nodo dummy con row che contiene il task
            edges: [],  // Vuoto per singolo task
            tasks: allTasksWithTemplates,  // ✅ Task + template referenziati
            ddts: [],
            translations: translations || {}
          })
        });

        console.log('[DDEBubbleChat] 📋 Compilation response:', {
          status: compileResponse.status,
          statusText: compileResponse.statusText,
          ok: compileResponse.ok,
          contentType: compileResponse.headers.get('content-type')
        });

        if (!compileResponse.ok) {
          const errorText = await compileResponse.text();
          console.error('[DDEBubbleChat] ❌ Compilation failed:', {
            status: compileResponse.status,
            statusText: compileResponse.statusText,
            error: errorText
          });
          throw new Error(`Failed to compile task: ${compileResponse.statusText} - ${errorText}`);
        }

        // ✅ Leggi la risposta (non la usiamo per costruire RuntimeTask, ma validiamo che la compilazione sia andata a buon fine)
        const responseText = await compileResponse.text();
        console.log('[DDEBubbleChat] 📋 Compilation response text:', {
          length: responseText.length,
          preview: responseText.substring(0, 500),
          isEmpty: responseText.trim().length === 0
        });

        if (!responseText || responseText.trim().length === 0) {
          throw new Error('[DDEBubbleChat] Compilation response is empty');
        }

        let compileResult: any;
        try {
          compileResult = JSON.parse(responseText);
          console.log('[DDEBubbleChat] 📋 Compilation result:', {
            taskGroups: compileResult.taskGroups?.length || 0,
            tasks: compileResult.tasks?.length || 0,
            compiledBy: compileResult.compiledBy
          });
        } catch (parseError) {
          console.error('[DDEBubbleChat] ❌ Failed to parse compilation result as JSON:', parseError);
          console.error('[DDEBubbleChat] ❌ Response text:', responseText);
          throw new Error(`Failed to parse compilation result: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }

        // ✅ Validazione: se c'è un errore nella risposta, fallisci
        if (compileResult.status === 'error' || compileResult.error) {
          throw new Error(`Compilation failed: ${compileResult.error || compileResult.message || 'Unknown error'}`);
        }

        // ✅ STEP 2.2: Il backend ha compilato il task, ma dobbiamo ottenere il RuntimeTask
        // Per ora, dobbiamo costruire il RuntimeTask dal TaskTree compilato
        // TODO: Il backend dovrebbe restituire il RuntimeTask compilato direttamente

        // ✅ STEP 2.3: Costruisci RuntimeTask dal TaskTree
        // Il backend compila Task → CompiledUtteranceTask, ma dobbiamo RuntimeTask per il repository
        // Costruiamo RuntimeTask dal TaskTree (workaround temporaneo)
        console.log('[DDEBubbleChat] 📋 STEP 2.3: Building RuntimeTask from TaskTree...');

        // ✅ FASE 2: Funzione per sanitizzare testi letterali → GUID
        const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const sanitizeSteps = (steps: any): any => {
          if (!steps) return steps;

          const sanitized = Array.isArray(steps) ? [...steps] : { ...steps };

          // Itera attraverso steps (può essere dictionary o array)
          const stepsEntries = Array.isArray(sanitized)
            ? sanitized.map((s, idx) => [idx.toString(), s])
            : Object.entries(sanitized);

          stepsEntries.forEach(([stepKey, step]: [string, any]) => {
            if (!step || !step.escalations) return;

            const escalations = Array.isArray(step.escalations) ? step.escalations : [step.escalations];

            escalations.forEach((esc: any) => {
              if (!esc || !esc.tasks) return;

              const taskItems = Array.isArray(esc.tasks) ? esc.tasks : [esc.tasks];

              taskItems.forEach((taskItem: any) => {
                if (!taskItem || !taskItem.parameters) return;

                const textParam = taskItem.parameters.find((p: any) =>
                  (p.parameterId === 'text' || p.key === 'text')
                );

                if (!textParam || !textParam.value) return;

                const value = String(textParam.value);
                const isGUID = GUID_REGEX.test(value);

                // ✅ Se non è un GUID, convertilo
                if (!isGUID && value.trim().length > 0) {
                  const newGuid = uuidv4();
                  textParam.value = newGuid;

                  // ✅ Salva traduzione
                  const addTranslationFn = addTranslation || (() => {
                    if (typeof window !== 'undefined' && (window as any).__projectTranslationsContext) {
                      const ctx = (window as any).__projectTranslationsContext;
                      if (ctx.addTranslation) {
                        return ctx.addTranslation;
                      } else if (ctx.addTranslations) {
                        return (guid: string, text: string) => ctx.addTranslations({ [guid]: text });
                      }
                    }
                    return (guid: string, text: string) => {
                      console.warn('[DDEBubbleChat] ⚠️ No translation context, literal text converted but not saved:', { guid, text: text.substring(0, 50) });
                    };
                  })();

                  if (addTranslationFn && typeof addTranslationFn === 'function') {
                    addTranslationFn(newGuid, value);
                    console.log('[DDEBubbleChat] ✅ Converted literal text to GUID:', {
                      oldText: value.substring(0, 50) + (value.length > 50 ? '...' : ''),
                      newGuid
                    });
                  }
                }
              });
            });
          });

          return sanitized;
        };

        // Funzione ricorsiva per convertire TaskTreeNode in RuntimeTask
        const buildRuntimeTaskFromNode = (node: any, stepsDict: Record<string, any>): any => {
          // Estrai steps per questo nodo dal dictionary steps
          // steps è: { "templateId": { "start": {...}, "noMatch": {...} } }
          const nodeSteps = stepsDict[node.templateId] || stepsDict[node.id] || {};

          // ✅ NORMALIZZAZIONE: Funzione helper per normalizzare step type (violation → invalid)
          const normalizeStepType = (stepType: string): string => {
            return stepType === 'violation' ? 'invalid' : stepType;
          };

          // Converti steps dictionary in array di DialogueStep
          // Ogni step ha: { id, textKey, type, ... }
          const stepsArray: any[] = [];

          // Helper per aggiungere step normalizzato
          const addStep = (stepKey: string, step: any) => {
            if (step) {
              const normalizedKey = normalizeStepType(stepKey);
              const normalizedStep = {
                ...step,
                type: step.type ? normalizeStepType(step.type) : normalizedKey
              };
              // Evita duplicati
              if (!stepsArray.some(s => s.type === normalizedStep.type)) {
                stepsArray.push(normalizedStep);
              }
            }
          };

          // Aggiungi step standard
          addStep('start', nodeSteps.start);
          addStep('noMatch', nodeSteps.noMatch);
          addStep('success', nodeSteps.success);
          addStep('failure', nodeSteps.failure);

          // Aggiungi altri step se presenti (incluso violation che verrà normalizzato)
          Object.keys(nodeSteps).forEach(key => {
            if (!['start', 'noMatch', 'success', 'failure'].includes(key)) {
              addStep(key, nodeSteps[key]);
            }
          });

          const runtimeTask: any = {
            id: node.id,
            condition: null,
            steps: stepsArray,
            constraints: node.constraints || [],
            nlpContract: node.dataContract || null,
            subTasks: null
          };

          // Costruisci subTasks ricorsivamente
          if (node.subNodes && node.subNodes.length > 0) {
            runtimeTask.subTasks = node.subNodes.map((subNode: any) =>
              buildRuntimeTaskFromNode(subNode, stepsDict)
            );
          }

          return runtimeTask;
        };

        // ✅ FASE 2: Sanitizza steps prima di costruire RuntimeTask (converte testi letterali → GUID)
        const sanitizedSteps = sanitizeSteps(taskTree.steps);

        // Costruisci RuntimeTask dal root node del TaskTree
        const rootNode = taskTree.nodes?.[0];
        if (!rootNode) {
          throw new Error('[DDEBubbleChat] TaskTree must have at least one node');
        }

        const runtimeTask = buildRuntimeTaskFromNode(rootNode, sanitizedSteps || {});
        // Imposta l'ID del root task
        runtimeTask.id = task.id;

        console.log('[DDEBubbleChat] 📋 RuntimeTask built:', {
          id: runtimeTask.id,
          stepsCount: runtimeTask.steps?.length || 0,
          constraintsCount: runtimeTask.constraints?.length || 0,
          hasSubTasks: !!runtimeTask.subTasks && runtimeTask.subTasks.length > 0,
          subTasksCount: runtimeTask.subTasks?.length || 0
        });

        // ✅ STEP 2.4: Salva il RuntimeTask nel repository
        console.log('[DDEBubbleChat] 📋 STEP 2.4: Saving dialog to repository...');

        const saveResponse = await fetch(`${baseUrl}/api/runtime/dialog/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: projectId,
            dialogVersion: dialogVersion,
            runtimeTask: runtimeTask
          })
        });

        if (!saveResponse.ok) {
          const errorText = await saveResponse.text();
          console.error('[DDEBubbleChat] ❌ Failed to save dialog:', saveResponse.status, errorText);
          throw new Error(`Failed to save dialog: ${saveResponse.statusText} - ${errorText}`);
        }

        // ✅ Check if response has content before parsing JSON
        const saveResponseText = await saveResponse.text();
        if (!saveResponseText || saveResponseText.trim().length === 0) {
          console.warn('[DDEBubbleChat] ⚠️ Empty response from save dialog endpoint, assuming success');
          // Assume success if response is empty (backend might return 200 with no body)
        } else {
          try {
            const saveResult = JSON.parse(saveResponseText);
            console.log('[DDEBubbleChat] 📋 Dialog saved:', {
              success: saveResult.success,
              projectId: saveResult.projectId,
              dialogVersion: saveResult.dialogVersion
            });
          } catch (jsonError) {
            console.error('[DDEBubbleChat] ❌ Failed to parse save response JSON:', jsonError);
            console.error('[DDEBubbleChat] Response text:', saveResponseText.substring(0, 200));
            // Continue anyway - the save might have succeeded even if response parsing failed
          }
        }

        // ✅ STATELESS: STEP 3: Avvia la sessione
        console.log('[DDEBubbleChat] 📋 STEP 3: Starting session...', {
          url: `${baseUrl}/api/runtime/task/session/start`,
          projectId,
          dialogVersion,
          locale: projectLanguage
        });

        const requestBody = {
          projectId: projectId,
          dialogVersion: dialogVersion, // ✅ Versione reale del progetto
          locale: projectLanguage, // ✅ Locale invece di language
          // ❌ RIMOSSO: taskId, taskInstanceId, translations, taskTree (configurazione immutabile - carica da repository)
        };

        const startResponse = await fetch(`${baseUrl}/api/runtime/task/session/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        console.log('[DDEBubbleChat] 📋 STEP 3 RESPONSE:', {
          status: startResponse.status,
          statusText: startResponse.statusText,
          ok: startResponse.ok
        });

        if (!startResponse.ok) {
          const errorText = await startResponse.text();
          console.error('[DDEBubbleChat] ❌ Backend error:', startResponse.status, errorText);
          setMessages([]);
          throw new Error(`Backend server not available: ${startResponse.statusText} - ${errorText}`);
        }

        // ✅ Verifica che la risposta abbia contenuto prima di fare parsing JSON
        const startResponseText = await startResponse.text();

        if (!startResponseText || startResponseText.trim().length === 0) {
          console.error('[DDEBubbleChat] ❌ Empty response from backend');
          throw new Error('Backend returned empty response');
        }

        let responseData: any;
        try {
          responseData = JSON.parse(startResponseText);
        } catch (parseError) {
          console.error('[DDEBubbleChat] Failed to parse JSON response:', parseError);
          console.error('[DDEBubbleChat] Response text:', startResponseText);
          throw new Error(`Failed to parse backend response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }

        const { sessionId: newSessionId } = responseData;
        setSessionId(newSessionId);

        // ✅ NUOVO: SSE stream diretto da VB.NET backend
        const eventSource = new EventSource(`${baseUrl}/api/runtime/task/session/${newSessionId}/stream`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          sessionStartingRef.current = false;
        };

        // Handle messages from backend
        // ❌ CRITICAL: ONLY add messages that come from backend - NO frontend logic
        eventSource.addEventListener('message', (e: MessageEvent) => {
          try {
            const msg = JSON.parse(e.data);

            // Only add message if it has actual text from backend
            const messageText = msg.text || msg.message || '';
            if (!messageText.trim()) {
              return;
            }

            // Determine message type from backend data
            const stepType = msg.stepType || 'ask';
            const textKey = msg.textKey || msg.key;

            // ✅ LOG: Messaggio mostrato in chat
            console.log('[Chat] 💬 Message displayed:', {
              text: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''),
              stepType,
              textKey: textKey || 'N/A'
            });

            // ❌ ONLY backend can determine messages - frontend just displays them
            setMessages((m) => [...m, {
              id: generateMessageId('bot'),
              type: 'bot',
              text: messageText,
              stepType: stepType as any,
              textKey: textKey,
              color: getStepColor(stepType)
            }]);
          } catch (error) {
            console.error('[DDEBubbleChat] Error parsing message', error);
            // ❌ Do NOT create fallback messages - if backend fails, show nothing
          }
        });

        // Handle waiting for input
        eventSource.addEventListener('waitingForInput', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            console.log('[MOTORE] ⏳ Waiting for input');
            setIsWaitingForInput(true);
          } catch (error) {
            console.error('[DDEBubbleChat] Error parsing waitingForInput', error);
          }
        });

        // Handle state updates
        eventSource.addEventListener('stateUpdate', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);

            // ✅ STATELESS: Log aggiornamento stato
            // State updates are handled by backend
          } catch (error) {
            console.error('[DDEBubbleChat] Error parsing stateUpdate', error);
          }
        });

        // Handle completion
        // ❌ CRITICAL: Only show success message if backend sends it - NO frontend-generated messages
        eventSource.addEventListener('complete', (e: MessageEvent) => {
          try {
            const result = JSON.parse(e.data);
            console.log('[MOTORE] 🎉 Task completed');
            // ❌ Only add message if backend explicitly sends a message in the result
            // Do NOT generate frontend messages like "✅ Dati raccolti con successo!"
            if (result.success && result.message) {
              // ✅ LOG: Messaggio di completamento mostrato in chat
              console.log('[Chat] 💬 Completion message displayed:', {
                text: result.message.substring(0, 100) + (result.message.length > 100 ? '...' : ''),
                stepType: 'success'
              });

              setMessages((m) => [...m, {
                id: generateMessageId('bot'),
                type: 'bot',
                text: result.message,
                stepType: 'success',
                color: getStepColor('success')
              }]);
            }
            setIsWaitingForInput(false);
          } catch (error) {
            console.error('[DDEBubbleChat] Error parsing complete', error);
            // ❌ Do NOT create fallback messages - if backend fails, show nothing
          }
        });

        // Handle errors
        eventSource.addEventListener('error', (e: MessageEvent) => {
          try {
            if (e.data) {
              const errorData = JSON.parse(e.data);
              setBackendError(errorData.error || 'Backend error');
            }
          } catch (error) {
            console.error('[DDEBubbleChat] Error parsing error event', error);
          }
        });

        eventSource.onerror = (error) => {
          console.error('[MOTORE] ❌ SSE connection error:', error);
          if (eventSource.readyState === EventSource.CLOSED) {
            // Clear messages when connection is closed - backend is not available
            setMessages([]);
            setBackendError('Connection to backend server closed. Is VB.NET server running on port 5000?');
            setIsWaitingForInput(false);
          }
        };
      } catch (error) {
        console.error('[DDEBubbleChat] Backend session error', error);
        // Clear any existing messages when connection fails
        setMessages([]);
        setBackendError(error instanceof Error ? error.message : 'Failed to connect to backend server. Is Ruby server running on port 3101?');
        setIsWaitingForInput(false);
        // ✅ Reset sessionStartingRef on error to allow retry
        sessionStartingRef.current = false;
        // ❌ NON resettare lastSessionKeyRef - deve persistere per bloccare duplicati
      }
    };

    startSession();

    // Cleanup on unmount
    return () => {
      // ✅ Reset sessionStartingRef (per permettere nuove sessioni)
      sessionStartingRef.current = false;
      // ❌ NON resettare lastSessionKeyRef qui - deve persistere per bloccare duplicati
      // Il ref verrà resettato solo quando task.id o projectId cambiano realmente
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (sessionId) {
        const baseUrl = 'http://localhost:5000';

        // ✅ STATELESS: Log eliminazione sessione
        // Session cleanup

        fetch(`${baseUrl}/api/runtime/task/session/${sessionId}`, {
          method: 'DELETE'
        }).catch(() => { });
      }
    };
  }, [task?.id, projectId, mode, resetCounter]); // ✅ Added resetCounter to trigger restart on reset

  // Clear input when sent text appears as a user message
  React.useEffect(() => {
    if (sentTextRef.current && messages.length > 0) {
      const matchingMessage = [...messages]
        .reverse()
        .find(m => m.type === 'user' && m.text === sentTextRef.current);

      if (matchingMessage) {
        setInlineDraft('');
        sentTextRef.current = '';
        requestAnimationFrame(() => ensureInlineFocus());
      }
    }
  }, [messages, setInlineDraft, ensureInlineFocus]);

  // Keep the inline input in view
  React.useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      try {
        inlineInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch { }
      try { ensureInlineFocus(); } catch { }
    });
    return () => cancelAnimationFrame(rafId);
  }, [messages.length, ensureInlineFocus]);

  // Handle sending user input to backend
  const handleSend = async (text: string) => {
    const trimmed = String(text || '').trim();
    if (!trimmed || !sessionId) return;

    try {
      console.log('[MOTORE] 📤 Sending input:', trimmed);

      // ✅ LOG: Messaggio utente mostrato in chat
      console.log('[Chat] 💬 User message displayed:', {
        text: trimmed.substring(0, 100) + (trimmed.length > 100 ? '...' : '')
      });

      // Add user message immediately
      setMessages((prev) => [...prev, {
        id: generateMessageId('user'),
        type: 'user',
        text: trimmed,
        matchStatus: 'match'
      }]);

      // Freeze text for input clearing
      sentTextRef.current = trimmed;

      // ✅ NUOVO: Send input to backend VB.NET direttamente
      const baseUrl = 'http://localhost:5000';
      const response = await fetch(`${baseUrl}/api/runtime/task/session/${sessionId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: trimmed
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send input: ${response.statusText} - ${errorText}`);
      }

      console.log('[MOTORE] ✅ Input sent successfully');

      // ✅ Lo stato isWaitingForInput verrà gestito dall'evento SSE waitingForInput
      // Non impostiamo false qui perché il backend potrebbe ancora processare l'input
      // e inviare un nuovo evento waitingForInput dopo aver eseguito il messaggio di risposta
    } catch (error) {
      console.error('[MOTORE] ❌ Error sending input:', error instanceof Error ? error.message : 'Unknown error');
      setBackendError(error instanceof Error ? error.message : 'Failed to send input to backend');
      // ✅ In caso di errore, riabilita l'input per permettere un nuovo tentativo
      setIsWaitingForInput(true);
    }
  };

  // Reset function - restart session with same task
  const handleReset = () => {
    // Close existing SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Delete session on backend
    if (sessionId) {
      const baseUrl = 'http://localhost:5000';
      fetch(`${baseUrl}/api/runtime/task/session/${sessionId}`, {
        method: 'DELETE'
      }).catch(() => { });
    }

    // Reset all state
    setMessages([]);
    messageIdCounter.current = 0;
    setBackendError(null);
    setIsWaitingForInput(false);
    sentTextRef.current = '';
    setSessionId(null);

    // ✅ CRITICAL: Reset refs to allow useEffect to restart session
    sessionStartingRef.current = false;
    lastSessionKeyRef.current = null; // Reset to allow new session start

    // ✅ CRITICAL: Increment reset counter to trigger useEffect re-run
    setResetCounter(prev => prev + 1);

    // Session will be restarted automatically by useEffect when resetCounter changes
  };

  return (
    <div className={`h-full flex flex-col bg-white ${combinedClass}`}>
      <div className="border-b p-3 bg-gray-50 flex items-center gap-2">
        <button
          onClick={handleReset}
          className={`px-2 py-1 rounded border bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 ${combinedClass}`}
          title="Reset the chat session"
        >
          Reset
        </button>
        {backendError && (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertTriangle size={16} />
            <span>{backendError}</span>
          </div>
        )}
      </div>
      {/* ✅ NEW: Tabs for preview mode */}
      {mode === 'preview' && activeScenario && onScenarioChange && (
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #334155',
            backgroundColor: '#1e293b',
          }}
        >
          {(['happy', 'partial', 'error'] as const).map((scenario) => (
            <button
              key={scenario}
              onClick={() => onScenarioChange(scenario)}
              style={{
                flex: 1,
                padding: '12px 16px',
                backgroundColor: activeScenario === scenario ? '#0f172a' : 'transparent',
                color: activeScenario === scenario ? '#e2e8f0' : '#94a3b8',
                border: 'none',
                borderBottom: activeScenario === scenario ? '2px solid #3b82f6' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: activeScenario === scenario ? 600 : 400,
                transition: 'all 0.2s',
              }}
            >
              {scenario === 'happy' && 'Happy Path'}
              {scenario === 'partial' && 'Frasi Parziali'}
              {scenario === 'error' && 'Errori'}
            </button>
          ))}
        </div>
      )}

      <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${combinedClass}`} ref={scrollContainerRef}>
        {displayMessages.map((m) => {
          if (m.type === 'user') {
            return (
              <UserMessage
                key={m.id}
                message={m}
                editingId={editingId}
                draftText={draftText}
                onEdit={handleEdit}
                onSave={handleSave}
                onCancel={handleCancel}
                onHover={setHoveredId}
              />
            );
          }

          if (m.type === 'bot') {
            return (
              <BotMessage
                key={m.id}
                message={m}
                editingId={editingId}
                draftText={draftText}
                hoveredId={hoveredId}
                onEdit={handleEdit}
                onSave={handleSave}
                onCancel={handleCancel}
                onHover={setHoveredId}
              />
            );
          }

          if (m.type === 'system') {
            return (
              <div key={m.id} className={`flex items-center gap-2 text-yellow-700 ${combinedClass}`}>
                <AlertTriangle size={12} className="flex-shrink-0 text-yellow-600" />
                <span>{m.text}</span>
              </div>
            );
          }

          return null;
        })}
        {/* ✅ NEW: Input field - hidden in preview mode */}
        {mode === 'interactive' && (
          <div className={`bg-white border border-gray-300 rounded-lg p-2 shadow-sm max-w-xs lg:max-w-md w-full mt-3 ${combinedClass}`}>
          <style dangerouslySetInnerHTML={{
            __html: `
            .chat-simulator-input-placeholder::placeholder {
              font-family: inherit !important;
              font-size: inherit !important;
            }
          `}} />
          <input
            type="text"
            className={`chat-simulator-input-placeholder w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500 ${combinedClass}`}
            style={{
              fontFamily: 'inherit',
              fontSize: 'inherit'
            }}
            ref={inlineInputRef}
            onFocus={() => {
              try { inlineInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch { }
            }}
            placeholder={isWaitingForInput ? "Type response..." : "Waiting for backend..."}
            value={inlineDraft}
            onChange={(e) => setInlineDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isWaitingForInput) {
                const v = inlineDraft.trim();
                if (!v) return;
                sentTextRef.current = v;
                void handleSend(v);
              }
            }}
            disabled={!isWaitingForInput}
            autoFocus
          />
          </div>
        )}
      </div>
    </div>
  );
}
