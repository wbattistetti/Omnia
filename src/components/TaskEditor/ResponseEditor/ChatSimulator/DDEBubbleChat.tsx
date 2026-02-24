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
import { taskRepository } from '@services/TaskRepository';
import { runDDT } from '@components/DialogueEngine/ddt/ddtEngine';
import type { AssembledTaskTree } from '@components/TaskTreeBuilder/DDTAssembler/currentDDT.types';
import type { DDTNavigatorCallbacks } from '@components/DialogueEngine/ddt/ddtTypes';

/**
 * Estrae tutti i GUID dai step (utterance, invalid, nomatch, noinput, escalation, constraint)
 * Formato steps: { "templateId": { "start": { escalations: [...] }, "noMatch": { escalations: [...] }, ... } }
 * GUID pattern: ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$
 */
function extractGuidsFromSteps(
  steps: Record<string, any>,
  guids: Set<string>
): void {
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let extractedCount = 0;

  // ✅ Formato: { "templateId": { "start": {...}, "noMatch": {...}, ... } }
  for (const [templateId, stepDict] of Object.entries(steps)) {
    if (!stepDict || typeof stepDict !== 'object') continue;

    // ✅ Gestisci anche il caso legacy: stepDict potrebbe essere un array
    if (Array.isArray(stepDict)) {
      for (const step of stepDict) {
        if (step?.escalations && Array.isArray(step.escalations)) {
          for (const escalation of step.escalations) {
            if (escalation.tasks && Array.isArray(escalation.tasks)) {
              for (const taskItem of escalation.tasks) {
                if (taskItem.parameters && Array.isArray(taskItem.parameters)) {
                  const textParam = taskItem.parameters.find((p: any) =>
                    p?.parameterId === 'text' || p?.key === 'text'
                  );
                  if (textParam?.value && guidPattern.test(textParam.value)) {
                    guids.add(textParam.value);
                    extractedCount++;
                  }
                }
                if (taskItem.id && guidPattern.test(taskItem.id)) {
                  guids.add(taskItem.id);
                  extractedCount++;
                }
              }
            }
          }
        }
      }
      continue;
    }

    // ✅ Itera su ogni tipo di step (start, noMatch, noInput, ecc.)
    for (const [stepType, step] of Object.entries(stepDict)) {
      if (!step || typeof step !== 'object') continue;

      // ✅ Estrai GUID dalle escalation
      if (step.escalations && Array.isArray(step.escalations)) {
        for (const escalation of step.escalations) {
          if (escalation.tasks && Array.isArray(escalation.tasks)) {
            for (const taskItem of escalation.tasks) {
              // ✅ GUID da taskItem.parameters (parametro con parameterId='text')
              if (taskItem.parameters && Array.isArray(taskItem.parameters)) {
                const textParam = taskItem.parameters.find((p: any) =>
                  p?.parameterId === 'text' || p?.key === 'text'
                );
                if (textParam?.value && guidPattern.test(textParam.value)) {
                  guids.add(textParam.value);
                  extractedCount++;
                }
              }
              // ✅ GUID da taskItem.id (se è un GUID)
              if (taskItem.id && guidPattern.test(taskItem.id)) {
                guids.add(taskItem.id);
                extractedCount++;
              }
            }
          }
        }
      }
    }
  }

  if (extractedCount > 0) {
    console.log(`[extractGuidsFromSteps] ✅ Extracted ${extractedCount} GUIDs from steps`);
  }
}

/**
 * Filtra le traduzioni per includere solo quelle runtime
 * Runtime translations sono:
 * 1. Chiavi che iniziano con "runtime." (pattern: runtime.DDT_<ID>.<step>#<n>.<action>.text)
 * 2. GUID che sono referenziati nei step dei task/DDT (utterance, invalid, nomatch, noinput, escalation, constraint)
 *
 * Traduzioni IDE (escluse):
 * - Label, description, help text, metadata UI
 * - Stringhe di configurazione, pannelli, wizard, menu, debug
 * - VariableReadableName, VariableDottedName, Synonyms
 */
function filterRuntimeTranslations(
  allTranslations: Record<string, string>,
  taskInstance: any,
  referencedTemplates: any[]
): Record<string, string> {
  const runtimeTranslations: Record<string, string> = {};

  // 1. Estrai tutti i GUID referenziati nei step dei task
  const runtimeGuids = new Set<string>();

  // Processa task instance
  if (taskInstance.steps && typeof taskInstance.steps === 'object') {
    console.log('[filterRuntimeTranslations] 📋 Processing task instance steps:', {
      taskId: taskInstance.id,
      stepsKeys: Object.keys(taskInstance.steps),
      stepsType: Array.isArray(taskInstance.steps) ? 'array' : 'object'
    });
    extractGuidsFromSteps(taskInstance.steps, runtimeGuids);
  }

  // Processa template referenziati
  for (const template of referencedTemplates) {
    if (template.steps && typeof template.steps === 'object') {
      console.log('[filterRuntimeTranslations] 📋 Processing template steps:', {
        templateId: template.id,
        stepsKeys: Object.keys(template.steps),
        stepsType: Array.isArray(template.steps) ? 'array' : 'object'
      });
      extractGuidsFromSteps(template.steps, runtimeGuids);
    }
  }

  console.log('[filterRuntimeTranslations] 📋 Extracted GUIDs:', {
    totalGuids: runtimeGuids.size,
    guids: Array.from(runtimeGuids).slice(0, 10) // First 10 for logging
  });

  // 2. Filtra traduzioni: solo quelle che sono GUID referenziati O chiavi runtime.*
  let runtimeKeyCount = 0;
  let guidMatchCount = 0;

  for (const [guid, text] of Object.entries(allTranslations)) {
    // Pattern runtime.* (es: runtime.DDT_xxx.start#1.SayMessage_1.text)
    if (guid.startsWith('runtime.')) {
      runtimeTranslations[guid] = text;
      runtimeKeyCount++;
    }
    // GUID referenziati nei step
    else if (runtimeGuids.has(guid)) {
      runtimeTranslations[guid] = text;
      guidMatchCount++;
    }
    // ❌ Tutte le altre (IDE) vengono escluse
  }

  console.log('[filterRuntimeTranslations] 📋 Filter result:', {
    totalTranslations: Object.keys(allTranslations).length,
    runtimeTranslations: Object.keys(runtimeTranslations).length,
    runtimeKeyCount,
    guidMatchCount,
    excludedIde: Object.keys(allTranslations).length - Object.keys(runtimeTranslations).length
  });

  return runtimeTranslations;
}

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
  engineType = 'vbnet', // ✅ NEW: Engine type selector (default to VB.NET for backward compatibility)
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
  engineType?: 'typescript' | 'vbnet'; // ✅ NEW: Engine type selector
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

    // ✅ NEW: TypeScript engine (frontend-only, no backend required)
    if (engineType === 'typescript') {
      const startTypeScriptEngine = async () => {
        try {
          if (!taskTree) {
            throw new Error('[DDEBubbleChat] TaskTree is required for TypeScript engine');
          }

          if (!task || !task.id) {
            throw new Error('[DDEBubbleChat] Task is required for TypeScript engine');
          }

          console.log('[DDEBubbleChat] 🚀 Starting TypeScript engine', {
            taskId: task.id,
            hasTaskTree: !!taskTree,
            hasTranslations: !!translations
          });

          // Convert TaskTree to AssembledTaskTree format
          const ddtInstance: AssembledTaskTree = {
            id: task.id,
            label: task.label || taskTree.labelKey || 'Task',
            nodes: taskTree.nodes || [],
            dialogueSteps: taskTree.steps ? Object.values(taskTree.steps).flatMap((stepDict: any) => {
              // Convert steps dictionary to flat array
              if (typeof stepDict === 'object' && !Array.isArray(stepDict)) {
                return Object.values(stepDict);
              }
              return Array.isArray(stepDict) ? stepDict : [];
            }) : [],
            translations: translations || {},
            introduction: taskTree.introduction
          };

          // Create callbacks for runDDT
          const callbacks: DDTNavigatorCallbacks = {
            onMessage: (text: string, stepType?: string, escalationNumber?: number) => {
              console.log('[DDEBubbleChat] 📨 TypeScript engine message:', { text, stepType, escalationNumber });
              const botMessage: Message = {
                id: generateMessageId('bot'),
                text,
                role: 'bot',
                timestamp: new Date(),
                stepType,
                escalationNumber
              };
              setMessages(prev => [...prev, botMessage]);
              setIsWaitingForInput(true);
            },
            onGetRetrieveEvent: async (nodeId: string) => {
              // Wait for user input
              return new Promise((resolve) => {
                // Store the resolve function to call when user submits input
                (window as any).__pendingRetrieveEvent = { nodeId, resolve };
              });
            },
            onProcessInput: async (input: string, node: any) => {
              // Simple processing - can be enhanced with NLP later
              if (!input || input.trim().length === 0) {
                return { status: 'noInput' as const };
              }
              // For now, always return match (can be enhanced with actual NLP)
              return { status: 'match' as const, value: input };
            },
            translations: translations || {}
          };

          // Start the TypeScript engine
          const result = await runDDT(ddtInstance, callbacks);

          if (result.exit) {
            console.log('[DDEBubbleChat] ✅ TypeScript engine completed', result);
            setIsWaitingForInput(false);
          } else if (result.error) {
            console.error('[DDEBubbleChat] ❌ TypeScript engine error:', result.error);
            setBackendError(result.error.message);
            setIsWaitingForInput(false);
          }
        } catch (error) {
          console.error('[DDEBubbleChat] ❌ TypeScript engine error:', error);
          setBackendError(error instanceof Error ? error.message : String(error));
          setIsWaitingForInput(false);
          sessionStartingRef.current = false;
        }
      };

      startTypeScriptEngine();
      return () => {
        // Cleanup: clear pending events on unmount
        delete (window as any).__pendingRetrieveEvent;
      };
    }

    // ✅ EXISTING: VB.NET backend engine
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
        // ✅ CRITICAL: Il compilatore VB.NET deve ricostruire tutto da zero
        // ✅ NON usare TaskTree della UI - è solo un artefatto grafico, non affidabile
        console.log('[DDEBubbleChat] 📋 STEP 2.1: Compiling task instance from repository (ignoring TaskTree)...');

        // ✅ CRITICAL: Carica l'istanza REALE dal repository (ignora TaskTree della UI)
        const taskInstance = taskRepository.getTask(task.id);
        if (!taskInstance) {
          throw new Error(`[DDEBubbleChat] Task instance not found in repository: ${task.id}. Cannot compile without instance.`);
        }

        // ✅ CRITICAL: Verifica che l'istanza abbia il campo type (obbligatorio per VB.NET)
        if (taskInstance.type === undefined || taskInstance.type === null) {
          throw new Error(`[DDEBubbleChat] Task instance ${task.id} has no type field. Task is invalid and cannot be compiled.`);
        }

        console.log('[DDEBubbleChat] 📋 Loaded task instance from repository:', {
          id: taskInstance.id,
          templateId: taskInstance.templateId,
          type: taskInstance.type,
          typeType: typeof taskInstance.type,
          hasSteps: !!(taskInstance.steps && Object.keys(taskInstance.steps).length > 0),
          hasSubTasksIds: !!(taskInstance.subTasksIds && taskInstance.subTasksIds.length > 0),
          hasDataContract: !!taskInstance.dataContract,
          ignoredTaskTree: true
        });

        // ✅ CORRETTO: Costruisci taskForCompilation SOLO dall'istanza (NON dal TaskTree)
        // Il compilatore VB.NET materializzerà nodes da zero usando template referenziati
        // ✅ CRITICAL INVARIANT: Steps vengono SOLO dall'istanza come override, NON dal template
        // Se l'istanza non ha steps, il nodo avrà Steps.Count = 0
        // Se ci sono constraints e Steps.Count = 0, la validazione fallisce
        const taskForCompilation = {
          id: taskInstance.id,
          templateId: taskInstance.templateId || taskInstance.id,
          type: taskInstance.type, // ✅ Deve essere presente (verificato sopra)
          label: taskInstance.label || '',
          // ✅ Includi solo campi dell'istanza
          value: taskInstance.value || {},
          parameters: taskInstance.parameters || [],
          subTasksIds: taskInstance.subTasksIds || [],
          constraints: taskInstance.constraints || [],
          // ✅ CRITICAL: dataContract must come from the TEMPLATE in DialogueTaskService,
          // not from the task instance in taskRepository.  The instance's dataContract
          // never contains subDataMapping (that is written by the wizard/editor into the
          // template).  The compiler looks up allTemplates[taskForCompilation.id] and reads
          // its DataContract — so we must supply the template's version here.
          dataContract: (() => {
            const tplId = taskInstance.templateId || taskInstance.id;
            const tplSource = DialogueTaskService.getTemplate(tplId);
            return tplSource?.dataContract ?? taskInstance.dataContract ?? null;
          })(),
          // ✅ CRITICAL: Steps vengono SOLO dall'istanza come override
          // Formato: { "templateId": [{ type: "start", ... }, { type: "invalid", ... }] }
          // Se manca, il nodo avrà Steps.Count = 0 e la validazione fallirà se ci sono constraints
          steps: taskInstance.steps || {},
          // ❌ NON includere: nodes (il compilatore VB.NET li materializza da zero)
        };

        // ✅ CORRETTO: Raccogli template referenziati SOLO dall'istanza e dai template (NON da TaskTree)
        const referencedTemplateIds = new Set<string>();

        // 1. Aggiungi templateId del task instance
        if (taskForCompilation.templateId) {
          referencedTemplateIds.add(taskForCompilation.templateId);
        }

        // 2. Raccogli templateId da subTasksIds dell'istanza
        if (taskInstance.subTasksIds && Array.isArray(taskInstance.subTasksIds)) {
          taskInstance.subTasksIds.forEach((id: string) => {
            if (id) referencedTemplateIds.add(id);
          });
        }

        // 3. Raccogli templateId ricorsivamente dai template referenziati
        // ✅ CRITICAL: Carica template e raccogli i loro subTasksIds ricorsivamente
        const collectTemplateIdsRecursively = (templateId: string, visited: Set<string>) => {
          if (visited.has(templateId)) {
            return; // Evita cicli infiniti
          }
          visited.add(templateId);

          try {
            const template = DialogueTaskService.getTemplate(templateId);
            if (template) {
              // Raccogli subTasksIds dal template
              if (template.subTasksIds && Array.isArray(template.subTasksIds)) {
                template.subTasksIds.forEach((id: string) => {
                  if (id && !referencedTemplateIds.has(id)) {
                    referencedTemplateIds.add(id);
                    // Ricorsione: raccogli anche i subTasksIds dei template referenziati
                    collectTemplateIdsRecursively(id, visited);
                  }
                });
              }
            }
          } catch (error) {
            console.warn(`[DDEBubbleChat] ⚠️ Error loading template ${templateId} for recursive collection:`, error);
          }
        };

        const visitedTemplates = new Set<string>();
        // Raccogli ricorsivamente da tutti i template già trovati
        Array.from(referencedTemplateIds).forEach(templateId => {
          collectTemplateIdsRecursively(templateId, visitedTemplates);
        });

        // ✅ Carica template referenziati da DialogueTaskService
        const referencedTemplates: any[] = [];
        referencedTemplateIds.forEach(templateId => {
          // Skip se il template è già il task stesso
          if (templateId === taskInstance.id) {
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

        // ✅ Combina task instance e template referenziati
        const allTasksWithTemplates = [taskForCompilation, ...referencedTemplates];

        console.log('[DDEBubbleChat] 📋 Compiling task instance (from repository, ignoring TaskTree):', {
          taskId: taskForCompilation.id,
          templateId: taskForCompilation.templateId,
          type: taskForCompilation.type,
          typeType: typeof taskForCompilation.type, // ✅ Should be "number"
          referencedTemplatesCount: referencedTemplates.length,
          totalTasksCount: allTasksWithTemplates.length,
          isFromRepository: true, // ✅ Flag per indicare che viene dal repository
          ignoredTaskTree: true // ✅ Flag per indicare che TaskTree è ignorato
        });

        // ✅ NUOVO: Usa endpoint dedicato per TaskInstance (NON FlowCompiler)
        console.log('[DDEBubbleChat] 📋 Sending compilation request to /api/runtime/compile/task:', {
          url: `${baseUrl}/api/runtime/compile/task`, // ✅ CORRETTO: /compile/task (con slash, non trattino)
          taskInstanceId: taskForCompilation.id,
          templateId: taskForCompilation.templateId,
          allTemplatesCount: allTasksWithTemplates.length
        });

        // ✅ NUOVO PAYLOAD: taskInstance + allTemplates (NON dummyNode, NON Flow)
        const compileRequestBody = {
          taskInstance: taskForCompilation, // ✅ TaskInstance da compilare
          allTemplates: allTasksWithTemplates // ✅ Tutti i template necessari (istanza + template referenziati)
        };

        // ✅ 1. LOG PRIMA DELLA COMPILAZIONE (frontend → backend)
        console.log('[DDEBubbleChat] 🧪 COMPILATION INPUT CHECK (TaskInstance mode):', {
          taskInstance: {
            id: taskForCompilation.id,
            templateId: taskForCompilation.templateId,
            type: taskForCompilation.type,
            typeType: typeof taskForCompilation.type,
            hasSteps: !!(taskForCompilation.steps && Object.keys(taskForCompilation.steps).length > 0),
            stepsKeys: taskForCompilation.steps ? Object.keys(taskForCompilation.steps) : [],
            stepsCount: taskForCompilation.steps ? Object.keys(taskForCompilation.steps).length : 0,
            // ✅ DEBUG: Mostra struttura steps per ogni templateId
            stepsStructure: taskForCompilation.steps ? Object.entries(taskForCompilation.steps).map(([templateId, steps]) => ({
              templateId,
              stepsType: Array.isArray(steps) ? 'array' : typeof steps,
              stepsKeys: typeof steps === 'object' && steps !== null ? Object.keys(steps) : [],
              stepsCount: Array.isArray(steps) ? steps.length : (typeof steps === 'object' && steps !== null ? Object.keys(steps).length : 0)
            })) : [],
            subTasksIds: taskForCompilation.subTasksIds || [],
            constraints: taskForCompilation.constraints || [],
            constraintsCount: taskForCompilation.constraints?.length || 0,
            dataContract: !!taskForCompilation.dataContract,
            isFromRepository: true,
            invariant: 'steps_from_instance_only'
          },
          allTemplates: allTasksWithTemplates.map(t => ({
            id: t.id,
            templateId: t.templateId,
            type: t.type,
            typeType: typeof t.type,
            isInstance: t.id === taskInstance.id,
            isTemplate: t.id !== taskInstance.id
          })),
          allTemplatesCount: allTasksWithTemplates.length,
          compilationMode: 'TaskInstance' // ✅ Conferma: NON Flow mode
        });

        const compileResponse = await fetch(`${baseUrl}/api/runtime/compile/task`, { // ✅ CORRETTO: /compile/task (con slash)
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(compileRequestBody)
        });

        console.log('[DDEBubbleChat] 📋 Compilation response:', {
          status: compileResponse.status,
          statusText: compileResponse.statusText,
          ok: compileResponse.ok,
          contentType: compileResponse.headers.get('content-type')
        });

        // ✅ Leggi la risposta
        const responseText = await compileResponse.text();

        // ✅ 3. LOG DIAGNOSTICI IN CASO DI ERRORE
        if (!compileResponse.ok) {
          let errorData: any = null;
          try {
            errorData = JSON.parse(responseText);
          } catch {
            errorData = { rawError: responseText };
          }

          console.error('[DDEBubbleChat] ❌ COMPILATION ERROR', {
            status: compileResponse.status,
            statusText: compileResponse.statusText,
            error: errorData.error || errorData.message || errorData.rawError || 'Unknown error',
            errorData: errorData,
            inputSummary: {
              instanceId: taskForCompilation.id,
              instanceTemplateId: taskForCompilation.templateId,
              instanceType: taskForCompilation.type,
              referencedTemplates: Array.from(referencedTemplateIds),
              referencedTemplatesCount: referencedTemplateIds.size,
              tasksSent: allTasksWithTemplates.map(t => ({
                id: t.id,
                templateId: t.templateId,
                type: t.type
              })),
              tasksSentCount: allTasksWithTemplates.length,
              missingTemplates: Array.from(referencedTemplateIds).filter(tid =>
                !allTasksWithTemplates.some(t => t.id === tid)
              )
              // ❌ RIMOSSO: rowTaskIdMatch (non più necessario, non usiamo più dummyNode)
            },
            diagnostic: {
              hasInstance: !!taskInstance,
              instanceHasType: taskInstance?.type !== undefined && taskInstance?.type !== null,
              instanceHasTemplateId: !!taskInstance?.templateId,
              allTemplatesLoaded: referencedTemplateIds.size === referencedTemplates.length,
              possibleCycles: visitedTemplates.size < referencedTemplateIds.size,
              unresolvedSubTasksIds: taskInstance?.subTasksIds?.filter(id =>
                !referencedTemplateIds.has(id)
              ) || []
            }
          });

          throw new Error(`Failed to compile task: ${compileResponse.statusText} - ${errorData.error || errorData.message || errorData.rawError || 'Unknown error'}`);
        }

        if (!responseText || responseText.trim().length === 0) {
          throw new Error('[DDEBubbleChat] Compilation response is empty');
        }

        let compileResult: any;
        try {
          compileResult = JSON.parse(responseText);
        } catch (parseError) {
          console.error('[DDEBubbleChat] ❌ Failed to parse compilation result as JSON:', parseError);
          console.error('[DDEBubbleChat] ❌ Response text:', responseText);
          throw new Error(`Failed to parse compilation result: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }

        // ✅ Validazione: se c'è un errore nella risposta, fallisci
        if (compileResult.status === 'error' || compileResult.error) {
          console.error('[DDEBubbleChat] ❌ COMPILATION ERROR (in response)', {
            status: compileResult.status,
            error: compileResult.error,
            message: compileResult.message,
            inputSummary: {
              instanceId: taskForCompilation.id,
              instanceTemplateId: taskForCompilation.templateId,
              referencedTemplates: Array.from(referencedTemplateIds)
            }
          });
          throw new Error(`Compilation failed: ${compileResult.error || compileResult.message || 'Unknown error'}`);
        }

        // ✅ NUOVO: La risposta da /api/runtime/compile/task è diversa
        // Non è FlowCompilationResult, ma un oggetto con compiledTask singolo
        console.log('[DDEBubbleChat] 📋 Compilation result (TaskInstance mode):', {
          success: compileResult.success,
          taskId: compileResult.taskId,
          compiledTaskId: compileResult.compiledTask?.id,
          compiledTaskType: compileResult.compiledTaskType,
          idMatch: compileResult.compiledTask?.id === taskForCompilation.id, // ✅ DEVE essere true
          debug: compileResult.compiledTask?.debug,
          originalTaskId: compileResult.compiledTask?.debug?.OriginalTaskId || compileResult.compiledTask?.debug?.originalTaskId,
          timestamp: compileResult.timestamp
        });

        // ✅ VERIFICA CRITICA: compiledTask.Id DEVE essere = taskInstance.id
        if (compileResult.compiledTask?.id !== taskForCompilation.id) {
          console.error('[DDEBubbleChat] ❌ ID MISMATCH:', {
            expectedId: taskForCompilation.id,
            actualId: compileResult.compiledTask?.id,
            compiledTask: compileResult.compiledTask
          });
          throw new Error(
            `[DDEBubbleChat] CompiledTask.Id mismatch: expected ${taskForCompilation.id}, got ${compileResult.compiledTask?.id}. ` +
            `The compiler MUST set compiledTask.Id = taskInstance.id for TaskInstance compilation.`
          );
        }

        // ✅ STEP 2.5: DEPLOY ON-THE-FLY - Sincronizza traduzioni MEMORIA → Redis
        // Ambiente "on-the-fly" per test automatico (effimero, nessuna persistenza)
        console.log('[DDEBubbleChat] 📋 STEP 2.5: Deploying translations from memory to Redis (on-the-fly)...');
        try {
          // ✅ Estrai tutte le traduzioni da window.__projectTranslationsContext
          const projectTranslationsContext = (window as any).__projectTranslationsContext;
          const allTranslations = projectTranslationsContext?.translations || {};

          console.log(`[DDEBubbleChat] 📋 Found ${Object.keys(allTranslations).length} total translations in memory`);

          // ✅ CRITICAL: Filtra SOLO traduzioni runtime (esclude IDE: label, description, help, metadata, UI, wizard, menu, debug)
          const runtimeTranslations = filterRuntimeTranslations(
            allTranslations,
            taskInstance,
            referencedTemplates
          );

          console.log(`[DDEBubbleChat] 📋 Filtered translations: ${Object.keys(allTranslations).length} total → ${Object.keys(runtimeTranslations).length} runtime (IDE excluded)`);

          if (Object.keys(runtimeTranslations).length === 0) {
            console.warn('[DDEBubbleChat] ⚠️ No runtime translations found - Redis may be incomplete');
          }

          const deployResponse = await fetch(`http://localhost:3100/api/deploy/sync-translations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: projectId,
              locale: projectLanguage,
              environment: 'on-the-fly', // ✅ Ambiente automatico per test
              type: 'full', // ✅ Full sync per garantire completezza
              translations: runtimeTranslations // ✅ SOLO runtime, IDE escluso
            })
          });

          if (!deployResponse.ok) {
            const errorText = await deployResponse.text();
            throw new Error(`Deployment failed: ${deployResponse.statusText} - ${errorText}`);
          }

          const deployResult = await deployResponse.json();
          console.log('[DDEBubbleChat] ✅ Translations deployed (on-the-fly):', {
            syncedCount: deployResult.syncedCount,
            source: deployResult.source,
            environment: deployResult.environment,
            duration: deployResult.duration
          });
        } catch (deployError) {
          console.error('[DDEBubbleChat] ❌ Deployment failed:', deployError);
          throw new Error(`Failed to deploy translations: ${deployError instanceof Error ? deployError.message : 'Unknown error'}. The runtime requires Redis to be complete before starting.`);
        }

        // ✅ STEP 2.3: Estrai CompiledTask dalla compilazione e convertilo in RuntimeTask
        // Il backend ha compilato il task e restituito CompiledTask
        // Convertiamo CompiledTask → RuntimeTask (ricorsivo con subTasks)
        console.log('[DDEBubbleChat] 📋 STEP 2.3: Extracting CompiledTask and converting to RuntimeTask...');

        // ✅ VERIFICA: Il backend DEVE restituire compiledTask
        if (!compileResult.compiledTask) {
          console.error('[DDEBubbleChat] ❌ COMPILATION BUG: compiledTask is missing!', {
            success: compileResult.success,
            taskId: compileResult.taskId,
            compiledTaskType: compileResult.compiledTaskType,
            fullResponse: compileResult
          });
          throw new Error(
            `[DDEBubbleChat] COMPILATION BUG: The VB.NET compiler did not return compiledTask. ` +
            `The compiler MUST return compiledTask in the response. ` +
            `This is a backend bug, not a frontend issue.`
          );
        }

        // ✅ Estrai CompiledTask dalla risposta (già verificato sopra che esiste)
        const compiledTask = compileResult.compiledTask;

        // ✅ LOGGING DETTAGLIATO: Mostra struttura completa del CompiledTask
        console.log('[DDEBubbleChat] 📋 Available tasks in compileResult (TaskInstance mode):', {
          count: 1, // ✅ TaskInstance mode restituisce un solo CompiledTask
          compiledTask: {
            id: compiledTask.id,
            debug: compiledTask.debug, // ✅ AGGIUNGI: mostra tutto debug
            originalTaskId: compiledTask.debug?.originalTaskId,
            OriginalTaskId: compiledTask.debug?.OriginalTaskId, // ✅ AGGIUNGI: prova anche PascalCase
            taskType: compiledTask.taskType,
            fullTask: compiledTask // ✅ AGGIUNGI: mostra task completo per debug
          }
        });

        console.log('[DDEBubbleChat] 📋 Found CompiledTask:', {
          id: compiledTask.id,
          taskType: compiledTask.taskType,
          hasSteps: !!compiledTask.steps,
          stepsCount: compiledTask.steps?.length || 0,
          hasSubTasks: !!compiledTask.subTasks,
          subTasksCount: compiledTask.subTasks?.length || 0,
          debug: compiledTask.debug,
          idMatchesInstance: compiledTask.id === taskForCompilation.id // ✅ DEVE essere true
        });

        // ✅ Converti CompiledTask → RuntimeTask (ricorsivo)
        // Funzione helper per convertire CompiledUtteranceTask in RuntimeTask
        const convertCompiledToRuntimeTask = (compiled: any): any => {
          const runtimeTask: any = {
            id: compiled.id,
            condition: compiled.condition || null,
            steps: compiled.steps || [],
            constraints: compiled.constraints || [],
            nlpContract: compiled.nlpContract || null,
            subTasks: null
          };

          // ✅ Copia SubTasks ricorsivamente (solo se presenti)
          if (compiled.subTasks && Array.isArray(compiled.subTasks) && compiled.subTasks.length > 0) {
            runtimeTask.subTasks = compiled.subTasks.map((subCompiled: any) =>
              convertCompiledToRuntimeTask(subCompiled)
            );
          }

          return runtimeTask;
        };

        const runtimeTask = convertCompiledToRuntimeTask(compiledTask);

        console.log('[DDEBubbleChat] 📋 RuntimeTask converted from CompiledTask:', {
          id: runtimeTask.id,
          stepsCount: runtimeTask.steps?.length || 0,
          constraintsCount: runtimeTask.constraints?.length || 0,
          hasSubTasks: !!runtimeTask.subTasks && runtimeTask.subTasks.length > 0,
          subTasksCount: runtimeTask.subTasks?.length || 0,
          source: 'compiled_by_backend'
        });

        // ✅ STEP 2.4: Salva il RuntimeTask nel repository (necessario per avviare sessione)
        // NOTA: Per test singolo task, potremmo non salvare, ma il backend si aspetta che il dialog esista
        console.log('[DDEBubbleChat] 📋 STEP 2.4: Saving dialog to repository...');
        console.log('[DDEBubbleChat] 📋 SAVING DIALOG:', {
          projectId,
          dialogVersion,
          locale: projectLanguage,
          runtimeTaskId: runtimeTask.id,
          runtimeTaskStepsCount: runtimeTask.steps?.length || 0,
          runtimeTaskHasSubTasks: !!runtimeTask.subTasks && runtimeTask.subTasks.length > 0,
          runtimeTaskKeys: Object.keys(runtimeTask)
        });

        const saveRequestBody = {
          projectId: projectId,
          dialogVersion: dialogVersion,
          runtimeTask: runtimeTask
        };

        console.log('[DDEBubbleChat] 📋 SAVE REQUEST BODY:', {
          projectId: saveRequestBody.projectId,
          dialogVersion: saveRequestBody.dialogVersion,
          runtimeTaskId: saveRequestBody.runtimeTask.id,
          runtimeTaskStepsCount: saveRequestBody.runtimeTask.steps?.length || 0
        });

        const saveResponse = await fetch(`${baseUrl}/api/runtime/dialog/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saveRequestBody)
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

        // ✅ LOG: Verifica cosa viene inviato al backend
        console.log('[DDEBubbleChat] 📋 STEP 3 REQUEST:', {
          url: `${baseUrl}/api/runtime/task/session/start`,
          requestBody,
          projectId,
          dialogVersion,
          locale: projectLanguage
        });

        const startResponse = await fetch(`${baseUrl}/api/runtime/task/session/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        console.log('[DDEBubbleChat] 📋 STEP 3 RESPONSE:', {
          status: startResponse.status,
          statusText: startResponse.statusText,
          ok: startResponse.ok,
          headers: Object.fromEntries(startResponse.headers.entries())
        });

        if (!startResponse.ok) {
          const errorText = await startResponse.text();
          console.error('[DDEBubbleChat] ❌ Backend error:', {
            status: startResponse.status,
            statusText: startResponse.statusText,
            errorText
          });
          setMessages([]);
          throw new Error(`Backend server not available: ${startResponse.statusText} - ${errorText}`);
        }

        // ✅ Verifica che la risposta abbia contenuto prima di fare parsing JSON
        const startResponseText = await startResponse.text();

        if (!startResponseText || startResponseText.trim().length === 0) {
          console.error('[DDEBubbleChat] ❌ Empty response from backend');
          throw new Error('Backend returned empty response');
        }

        console.log('[DDEBubbleChat] 📋 STEP 3 RESPONSE TEXT:', {
          length: startResponseText.length,
          preview: startResponseText.substring(0, 200),
          fullText: startResponseText
        });

        let responseData: any;
        try {
          responseData = JSON.parse(startResponseText);
          console.log('[DDEBubbleChat] 📋 STEP 3 PARSED RESPONSE:', {
            responseData,
            hasSessionId: !!responseData.sessionId,
            sessionId: responseData.sessionId,
            otherKeys: Object.keys(responseData)
          });
        } catch (parseError) {
          console.error('[DDEBubbleChat] Failed to parse JSON response:', parseError);
          console.error('[DDEBubbleChat] Response text:', startResponseText);
          throw new Error(`Failed to parse backend response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }

        const { sessionId: newSessionId } = responseData;

        // ✅ LOG: Verifica che sessionId sia valido
        if (!newSessionId) {
          console.error('[DDEBubbleChat] ❌ Backend returned empty sessionId');
          throw new Error('Backend returned empty sessionId');
        }

        console.log('[DDEBubbleChat] ✅ Session started successfully:', {
          sessionId: newSessionId,
          sessionIdType: typeof newSessionId,
          sessionIdLength: String(newSessionId).length
        });

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

            // ✅ LOG: Verifica se stateUpdate contiene dati estratti
            console.log('[DDEBubbleChat] 📊 stateUpdate received:', {
              hasExtractedData: !!data.extractedData,
              hasExtractedValues: !!data.extractedValues,
              hasData: !!data.data
            });

            // ✅ Se stateUpdate contiene dati estratti, aggiorna il messaggio utente più recente
            if (data.extractedData || data.extractedValues || data.data) {
              const extractedData = data.extractedData || data.extractedValues || data.data;

              // Converti i dati estratti nel formato ExtractedValue[]
              const convertToExtractedValues = (value: any): any[] => {
                if (!value || typeof value !== 'object') return [];
                const result: any[] = [];
                Object.entries(value).forEach(([key, val]) => {
                  result.push({
                    variable: key,
                    semanticValue: val,
                    linguisticValue: typeof val === 'string' ? val : undefined
                  });
                });
                return result;
              };

              const extractedValues = convertToExtractedValues(extractedData);

              // ✅ CRITICAL: Aggiorna SOLO se ci sono dati estratti E sono diversi da quelli esistenti
              if (extractedValues.length > 0) {
                setMessages((prev) => {
                  // Trova l'ultimo messaggio utente
                  const lastUserIndex = prev.findLastIndex(m =>
                    m.type === 'user' && m.text === sentTextRef.current
                  );

                  if (lastUserIndex === -1) {
                    console.log('[DDEBubbleChat] ⚠️ No matching user message found');
                    return prev; // ✅ Non cambiare lo stato se non c'è match
                  }

                  const existingMessage = prev[lastUserIndex];
                  const oldValues = JSON.stringify(existingMessage.extractedValues || []);
                  const newValues = JSON.stringify(extractedValues);

                  // ✅ CRITICAL: Aggiorna SOLO se i valori sono realmente cambiati
                  if (oldValues === newValues) {
                    console.log('[DDEBubbleChat] ⏭️ Extracted values unchanged, skipping update');
                    return prev; // ✅ Non cambiare lo stato → evita re-render
                  }

                  console.log('[DDEBubbleChat] ✅ Updating user message with extracted values:', {
                    messageId: existingMessage.id,
                    extractedValuesCount: extractedValues.length,
                    oldValuesCount: existingMessage.extractedValues?.length || 0
                  });

                  // ✅ Aggiorna solo se i valori sono cambiati
                  const updated = [...prev];
                  updated[lastUserIndex] = {
                    ...existingMessage,
                    extractedValues
                  };
                  return updated;
                });
              }
            }

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
  }, [task?.id, projectId, mode, resetCounter, engineType, taskTree, translations]); // ✅ Added engineType, taskTree, translations to trigger restart when engine changes

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

  // Handle sending user input to backend or TypeScript engine
  const handleSend = async (text: string) => {
    const trimmed = String(text || '').trim();

    // ✅ LOG: Verifica sessionId prima di inviare
    console.log('[DDEBubbleChat] 🔍 handleSend check:', {
      trimmed,
      sessionId,
      hasSessionId: !!sessionId,
      sessionIdType: typeof sessionId,
      isWaitingForInput,
      engineType
    });

    if (!trimmed) {
      console.warn('[DDEBubbleChat] ⚠️ Empty input, ignoring');
      return;
    }

    // Add user message immediately
    setMessages((prev) => [...prev, {
      id: generateMessageId('user'),
      type: 'user',
      text: trimmed,
      matchStatus: 'match'
    }]);

    // Freeze text for input clearing
    sentTextRef.current = trimmed;

    // ✅ NEW: TypeScript engine - resolve pending retrieve event
    if (engineType === 'typescript') {
      try {
        console.log('[DDEBubbleChat] 📤 TypeScript engine: processing input:', trimmed);

        // Check if there's a pending retrieve event
        const pendingEvent = (window as any).__pendingRetrieveEvent;
        if (pendingEvent && pendingEvent.resolve) {
          // Resolve the pending event with user input
          pendingEvent.resolve({ type: 'match', value: trimmed });
          delete (window as any).__pendingRetrieveEvent;
          setIsWaitingForInput(false);
        } else {
          console.warn('[DDEBubbleChat] ⚠️ No pending retrieve event, engine may not be running');
          setIsWaitingForInput(true);
        }
      } catch (error) {
        console.error('[DDEBubbleChat] ❌ TypeScript engine error processing input:', error);
        setBackendError(error instanceof Error ? error.message : 'Failed to process input');
        setIsWaitingForInput(true);
      }
      return;
    }

    // ✅ EXISTING: VB.NET backend engine
    if (!sessionId) {
      console.error('[DDEBubbleChat] ❌ No sessionId available - session may not be initialized');
      setBackendError('Session not initialized. Please wait for the session to start or click Reset.');
      return;
    }

    try {
      console.log('[MOTORE] 📤 Sending input:', trimmed);

      // ✅ LOG: Messaggio utente mostrato in chat
      console.log('[Chat] 💬 User message displayed:', {
        text: trimmed.substring(0, 100) + (trimmed.length > 100 ? '...' : '')
      });

      // ✅ EXISTING: Send input to backend VB.NET
      const baseUrl = 'http://localhost:5000';
      const inputUrl = `${baseUrl}/api/runtime/task/session/${sessionId}/input`;

      console.log('[DDEBubbleChat] 📤 Sending input to backend:', {
        url: inputUrl,
        sessionId,
        input: trimmed
      });

      const response = await fetch(inputUrl, {
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
    // ✅ NEW: Clear TypeScript engine pending events
    if (engineType === 'typescript') {
      delete (window as any).__pendingRetrieveEvent;
    }

    // Close existing SSE connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Delete session on backend (only for VB.NET engine)
    if (engineType === 'vbnet' && sessionId) {
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
