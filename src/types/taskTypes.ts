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
  DataRequest = 3,     // TaskTypes.DataRequest (rinominato da GetData)
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
    case TaskType.DataRequest: return 'DataRequest';
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
    case 'getdata': return TaskType.DataRequest; // ✅ Backward compatibility: 'getdata' → DataRequest
    case 'datarequest': return TaskType.DataRequest;
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
    case 'datarequest': return TaskType.DataRequest;
    case 'getdata': return TaskType.DataRequest; // ✅ Backward compatibility
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
    case 'REQUEST_DATA': return TaskType.DataRequest;
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
    case TaskType.DataRequest: return 'DataRequest';
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
    case TaskType.DataRequest:
      return 'ddt';
    case TaskType.AIAgent:
      return 'aiagent';
    case TaskType.Summarizer:
      return 'summarizer';
    case TaskType.Negotiation:
      return 'negotiation';
    case TaskType.ClassifyProblem:
      return 'problem';
    case TaskType.BackendCall:
      return 'backend';
    default:
      return 'simple';
  }
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
  name?: string;                 // ✅ Nome semantico (opzionale, per built-in: "DataRequest", "SayMessage")
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
 * - templateId = null → Task standalone (non referenzia altri Task)
 * - templateId = GUID → Task che referenzia un altro Task (per ereditare struttura/contratti)
 *
 * Esempi:
 * - Task DDT standalone: { id: "guid", type: TaskType.DataRequest, templateId: null, label: "...", mainData: [...] }
 * - Task DDT che referenzia: { id: "guid", type: TaskType.DataRequest, templateId: "guid-altro-task", label: "...", mainData: [...] }
 *
 * Per altri tipi di task (SayMessage, BackendCall, ecc.):
 * - Task standalone: { id: "guid", type: TaskType.SayMessage, templateId: null, text: "Ciao!", ... }
 * - Task che referenzia: { id: "guid", type: TaskType.SayMessage, templateId: "guid-altro-task", text: "Ciao!", ... }
 */
export interface Task {
  id: string;                    // ✅ GUID univoco
  type: TaskType;                 // ✅ Enum numerico (0-19) - Determina il comportamento del task
  templateId: string | null;      // ✅ null = Task standalone, GUID = referenzia un altro Task
  // ✅ Campi diretti (niente wrapper value):
  // Per DataRequest/DDT:
  label?: string;                // Label del DDT (solo per UI, non usato a runtime)
  mainData?: any[];              // Main data array (senza steps - steps sono in dialogueSteps)
  dialogueSteps?: any[];         // ✅ Flat dialogue steps array (replaces nested mainData[].steps)
  stepPrompts?: any;             // Step prompts
  constraints?: any[];           // Constraints
  examples?: any[];              // Examples
  // Per SayMessage:
  text?: string;                 // Message text
  // Per ClassifyProblem:
  intents?: any[];               // Intents array
  // Per BackendCall:
  endpoint?: string;             // API endpoint
  method?: string;              // HTTP method
  params?: Record<string, any>;  // Parameters
  // Generic fields:
  [key: string]: any;           // Allow additional fields
  createdAt?: Date;
  updatedAt?: Date;
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

