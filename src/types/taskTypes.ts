// New Task-based model types
// These types are added alongside existing types for gradual migration

/**
 * TaskContext: Enumerated contexts where a TaskInstance can be inserted
 */
export enum TaskContext {
  NodeRow = 'NodeRow',      // Riga di nodo nel flowchart
  Response = 'Response'     // Dentro escalation di step in DDT
}

/**
 * TaskType: Enum numerato per i tipi di task (allineato con VB.NET TaskTypes)
 * ✅ UNIFICATO: Usato ovunque invece di HeuristicType/InternalType/templateId stringhe
 * Determina il comportamento del task e quale editor usare
 */
export enum TaskType {
  UNDEFINED = -1,      // ✅ Task non ancora tipizzato (punto interrogativo)
  SayMessage = 0,      // TaskTypes.SayMessage
  CloseSession = 1,    // TaskTypes.CloseSession
  Transfer = 2,        // TaskTypes.Transfer
  UtteranceInterpretation = 3,     // TaskTypes.UtteranceInterpretation (interpreta utterance utente per estrarre dati)
  BackendCall = 4,     // TaskTypes.BackendCall
  ClassifyProblem = 5, // TaskTypes.ClassifyProblem
  AIAgent = 6,         // ✅ AI Agent task
  Summarizer = 7,      // ✅ Summarizer task
  Negotiation = 8      // ✅ Negotiation task
}

/**
 * ✅ Helper: Converte TaskType enum → templateId string (per Task.templateId)
 */
export function taskTypeToTemplateId(type: TaskType): string | null {
  switch (type) {
    case TaskType.SayMessage: return 'SayMessage';
    case TaskType.UtteranceInterpretation: return 'UtteranceInterpretation';
    case TaskType.ClassifyProblem: return 'ClassifyProblem';
    case TaskType.BackendCall: return 'BackendCall';
    case TaskType.CloseSession: return 'CloseSession';
    case TaskType.Transfer: return 'Transfer';
    case TaskType.AIAgent: return 'AIAgent';
    case TaskType.Summarizer: return 'Summarizer';
    case TaskType.Negotiation: return 'Negotiation';
    case TaskType.UNDEFINED: return 'UNDEFINED';
    default: return null;
  }
}

/**
 * ✅ Helper: Converte templateId string → TaskType enum
 */
export function templateIdToTaskType(templateId: string | null | undefined): TaskType {
  if (!templateId) return TaskType.UNDEFINED;
  const normalized = templateId.toLowerCase().trim();
  switch (normalized) {
    case 'saymessage': return TaskType.SayMessage;
    case 'utteranceinterpretation': return TaskType.UtteranceInterpretation;
    case 'classifyproblem': return TaskType.ClassifyProblem;
    case 'backendcall': return TaskType.BackendCall;
    case 'closesession': return TaskType.CloseSession;
    case 'transfer': return TaskType.Transfer;
    case 'aiagent': return TaskType.AIAgent;
    case 'summarizer': return TaskType.Summarizer;
    case 'negotiation': return TaskType.Negotiation;
    case 'undefined': return TaskType.UNDEFINED;
    default: return TaskType.UNDEFINED;
  }
}

/**
 * ✅ Helper: Converte stringa semantica legacy (da UI/Intellisense/database) → TaskType enum
 * ⚠️ TEMPORANEO: Usato per backward compatibility durante la migrazione
 * TODO: Eliminare quando tutti i punti che passano stringhe semantiche saranno aggiornati a TaskType enum
 *
 * @param taskId - Stringa semantica legacy (es. "Message", "DataRequest", "ProblemClassification")
 * @returns TaskType enum corrispondente
 */
export function taskIdToTaskType(taskId: string): TaskType { // ✅ RINOMINATO: actIdToTaskType → taskIdToTaskType
  const normalized = taskId.toLowerCase().trim(); // ✅ FIX: actId → taskId

  // Mapping taskId (UI) → TaskType enum
  switch (normalized) {
    case 'message': return TaskType.SayMessage;
    case 'utteranceinterpretation': return TaskType.UtteranceInterpretation;
    case 'problemclassification': return TaskType.ClassifyProblem;
    case 'classifyproblem': return TaskType.ClassifyProblem;
    case 'backendcall': return TaskType.BackendCall;
    case 'callbackend': return TaskType.BackendCall;
    case 'closesession': return TaskType.CloseSession;
    case 'transfer': return TaskType.Transfer;
    case 'aiagent': return TaskType.AIAgent;
    case 'summarizer': return TaskType.Summarizer;
    case 'negotiation': return TaskType.Negotiation;
    case 'undefined': return TaskType.UNDEFINED;
    default: return TaskType.UNDEFINED;
  }
}

/**
 * ✅ Helper: Converte HeuristicType string (legacy) → TaskType enum
 * Usato durante la migrazione per compatibilità
 * @deprecated Usa taskIdToTaskType() invece
 */
export function heuristicStringToTaskType(heuristic: string): TaskType {
  const normalized = heuristic.toUpperCase().trim();
  switch (normalized) {
    case 'MESSAGE': return TaskType.SayMessage;
    case 'REQUEST_DATA': return TaskType.UtteranceInterpretation;
    case 'PROBLEM_SPEC': return TaskType.ClassifyProblem;
    case 'BACKEND_CALL': return TaskType.BackendCall;
    case 'AI_AGENT': return TaskType.SayMessage; // Default to SayMessage
    case 'NEGOTIATION': return TaskType.SayMessage; // Default to SayMessage
    case 'SUMMARY': return TaskType.SayMessage; // Default to SayMessage
    case 'UNDEFINED': return TaskType.UNDEFINED;
    default: return TaskType.UNDEFINED;
  }
}

/**
 * ✅ Helper: Converte TaskType enum → string per euristica 2 (DDTTemplateMatcherService)
 */
export function taskTypeToHeuristicString(type: TaskType): string | null {
  switch (type) {
    case TaskType.UtteranceInterpretation: return 'UtteranceInterpretation';
    case TaskType.SayMessage: return 'Message';
    case TaskType.UNDEFINED: return 'UNDEFINED';
    default: return null;
  }
}

/**
 * Helper: Deriva il tipo di editor da TaskType
 */
export function getEditorFromTaskType(type: TaskType): 'message' | 'ddt' | 'problem' | 'backend' | 'simple' | 'aiagent' | 'summarizer' | 'negotiation' {
  switch (type) {
    case TaskType.SayMessage:
    case TaskType.CloseSession:
    case TaskType.Transfer:
      return 'message';
    case TaskType.UtteranceInterpretation:
      return 'ddt';
    case TaskType.AIAgent:
      return 'aiagent';
    case TaskType.Summarizer:
      return 'summarizer';
    case TaskType.Negotiation:
      return 'negotiation';
    case TaskType.ClassifyProblem:
      return 'ddt'; // ✅ UNIFICATO: ClassifyProblem ora usa ResponseEditor (DDT) come UtteranceInterpretation
    case TaskType.BackendCall:
      return 'backend';
    default:
      return 'simple';
  }
}

/**
 * ✅ Helper: Verifica se un task è di tipo UtteranceInterpretation
 * Sostituisce stringhe hardcoded come templateId.toLowerCase() !== 'datarequest'
 */
export function isUtteranceInterpretationTask(task: { type?: TaskType; templateId?: string | null } | null | undefined): boolean {
  if (!task) return false;
  if (task.type !== undefined) {
    return task.type === TaskType.UtteranceInterpretation;
  }
  if (task.templateId) {
    return templateIdToTaskType(task.templateId) === TaskType.UtteranceInterpretation;
  }
  return false;
}

/**
 * ✅ Helper: Verifica se un templateId corrisponde a UtteranceInterpretation
 * Sostituisce stringhe hardcoded come templateId.toLowerCase() === 'datarequest'
 */
export function isUtteranceInterpretationTemplateId(templateId: string | null | undefined): boolean {
  if (!templateId) return false;
  return templateIdToTaskType(templateId) === TaskType.UtteranceInterpretation;
}

/**
 * TaskCatalog: Defines a type of executable task (catalog entry)
 * Replaces: AgentActs, Action Catalog entries
 *
 * TaskCatalog è organizzato per scope:
 * - global: disponibile in tutti i progetti
 * - industry: disponibile solo per progetti di quell'industry
 * - client: disponibile solo nel progetto specifico
 *
 * ✅ REFACTORED: id è GUID (univoco), type è enum numerato, editor derivabile da type
 */
export interface TaskCatalog {
  id: string;                    // ✅ GUID univoco (permette più catalog entries dello stesso tipo)
  label: string;                 // Display label
  description: string;           // Description
  icon: string;                  // Icon name (e.g. "MessageCircle", "HelpCircle")
  color: string;                 // UI color (e.g. "text-blue-500")
  type: TaskType;                // ✅ Enum numerato (comportamento: DataRequest, SayMessage, ecc.)
  name?: string;                 // ✅ Nome semantico (opzionale, per built-in: "UtteranceInterpretation", "SayMessage")
  contexts: TaskContext[];        // ✅ Where this catalog entry can be inserted

  // Signature: Input parameters schema (if needed)
  signature?: {
    params: {
      [key: string]: {
        type: string;
        required?: boolean;
        multilang?: boolean;
        multistyle?: boolean;
        default?: any;
      };
    };
  };

  // ValueSchema: Defines the structure of Task.value
  // ❌ REMOVED: editor (derivabile da type con getEditorFromTaskType())
  valueSchema: {                 // Defines Task.value structure
    keys: {                        // Valid keys in Task.value
      [key: string]: {
        type: 'string' | 'object' | 'array' | 'ddt' | 'problem';
        required?: boolean;
        description?: string;
        // IDE mapping: How to render in the editor
        ideMapping?: {
          control: 'text' | 'textarea' | 'ddt-editor' | 'problem-editor' | 'json';
          label?: string;
          placeholder?: string;
        };
      };
    };
  };

  scope?: 'global' | 'industry' | 'client';  // Scope del catalog entry
  industry?: string;             // Industry specifico (se scope='industry')
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * TaskHeuristic: Pattern-based rules for task type detection
 * Replaces: act_type_patterns
 */
export interface TaskHeuristic {
  type: 'MESSAGE' | 'REQUEST_DATA' | 'PROBLEM' | 'BACKEND_CALL' | 'AI_AGENT' | 'PROBLEM_SPEC_DIRECT' | 'PROBLEM_REASON' | 'SUMMARY' | 'NEGOTIATION';
  patterns: string[];             // Array di regex patterns
  language: string;               // 'IT', 'EN', 'PT', etc.
}

/**
 * Task: Unified structure for all tasks
 *
 * - type: TaskType enum numerico (0-19) → Determina il comportamento del task
 * - templateId = null → Crea automaticamente un nuovo template (ogni task ha sempre un templateId)
 * - templateId = GUID → Task che referenzia un template (per ereditare struttura/contratti)
 *
 * IMPORTANTE:
 * - Ogni task DEVE avere un templateId (o viene creato automaticamente)
 * - Non esistono più "task standalone" come concetto separato
 * - La struttura (data, constraints, dataContract) viene sempre dal template, non dall'istanza
 * - L'istanza contiene solo override: steps, label, introduction
 *
 * Esempi:
 * - Task con template: { id: "guid", type: TaskType.UtteranceInterpretation, templateId: "template-guid", label: "...", steps: {...} }
 * - Task senza templateId: { id: "guid", type: TaskType.UtteranceInterpretation, templateId: null, ... } → viene creato template automaticamente
 */
export interface Task {
  id: string;                    // ✅ GUID univoco
  type: TaskType;                 // ✅ Enum numerico (0-19) - Determina il comportamento del task
  templateId: string | null;      // ✅ null = crea template automaticamente, GUID = referenzia un template
  // ✅ Campi diretti (niente wrapper value):
  // Per DataRequest/UtteranceInterpretation:
  label?: string;                // Label override (se diversa dal template)
  // ❌ RIMOSSO: data - Non più persistito. Costruisci TaskTree da templateId usando buildTaskTree()
  // ❌ RIMOSSO: constraints - Vengono sempre dal template, non dall'istanza
  // ❌ RIMOSSO: examples - Vengono sempre dal template, non dall'istanza
  // ❌ RIMOSSO: dataContract - Viene sempre dal template, non dall'istanza
  dialogueSteps?: any[];         // ✅ Flat dialogue steps array (replaces nested data[].steps) - DEPRECATED
  steps?: Record<string, any>;   // ✅ Steps override a root level: { "templateId": { start: {...}, noMatch: {...} } }
  // ❌ DEPRECATED: stepPrompts - use steps instead
  stepPrompts?: any;             // @deprecated Use steps instead
  introduction?: any;             // ✅ Introduction override (opzionale)
  // Per SayMessage:
  text?: string;                 // Message text
  // Per ClassifyProblem:
  intents?: any[];               // Intents array
  // Per BackendCall:
  endpoint?: string;             // API endpoint
  method?: string;              // HTTP method
  params?: Record<string, any>;  // Parameters

  // ✅ TODO FUTURO: Category System (vedi documentation/TODO_NUOVO.md)
  // category?: string;              // ID categoria (preset o custom)
  // categoryCustom?: CustomCategory; // Se custom, dettagli completi

  // Generic fields:
  [key: string]: any;           // Allow additional fields
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * TaskTreeNode: Nodo dell'albero TaskTree (vista runtime)
 * NON è un'entità persistita, è solo una vista costruita da Template + Instance
 */
export interface TaskTreeNode {
  id: string;                    // ✅ ID del nodo
  templateId: string;            // ✅ ID del template referenziato (fondamentale per il grafo)
  label: string;                  // ✅ Label del nodo
  type?: string;                  // ✅ Tipo del dato (es. 'date', 'email', 'text')
  icon?: string;                  // ✅ Icona per UI
  constraints?: any[];            // ✅ Dal template (sempre, non dall'istanza)
  dataContract?: any;             // ✅ Dal template (sempre, non dall'istanza)
  subNodes?: TaskTreeNode[];     // ✅ Nodi figli (ricorsivo)
}

/**
 * TaskTree: Vista runtime costruita da Template + Instance
 * NON è un'entità persistita, NON è un DDT rinominato
 * È solo una vista in memoria per l'editor, costruita dinamicamente
 *
 * Costruzione:
 * - Template fornisce: struttura (nodes), constraints, dataContract
 * - Instance fornisce: steps override, label override, introduction override
 *
 * Uso:
 * - ResponseEditor usa TaskTree per mostrare la struttura nella sidebar
 * - TaskTree viene costruito ogni volta che si apre l'editor (non viene salvato)
 */
export interface TaskTree {
  label: string;                 // ✅ Label (da instance se override, altrimenti da template)
  nodes: TaskTreeNode[];         // ✅ Nodi principali (costruiti da template.subTasksIds)
  steps: Record<string, any>;     // ✅ Steps override per ogni nodo: { "templateId": { start: {...}, ... } }
  constraints?: any[];           // ✅ Dal template (sempre)
  dataContract?: any;            // ✅ Dal template (sempre)
  introduction?: any;             // ✅ Opzionale (da instance se override)
}

/**
 * TaskInstance: Alias for Task (for backward compatibility during migration)
 * @deprecated Use Task instead
 */
export type TaskInstance = Task;

/**
 * FlowRow: Topological element in the flowchart
 * Replaces: NodeRowData (but keeps topology separate from Task logic)
 * Relationship: 1:1 with Task (row.taskId → Task.id)
 */
export interface FlowRow {
  id: string;                    // Topological ID of the row (position in graph)
  taskId: string;                // Reference to Task (1:1, always)
  text: string;                  // Display text
  included?: boolean;            // If included in flow
  order?: number;                 // Execution order in node (for sequence)
}

// ❌ RIMOSSO: taskTypeToModeString e modeStringToTaskType - non servono più, backend usa solo type (TaskType enum)

