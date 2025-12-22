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
 * Determina il comportamento del task e quale editor usare
 */
export enum TaskType {
  SayMessage = 0,      // TaskTypes.SayMessage
  CloseSession = 1,    // TaskTypes.CloseSession
  Transfer = 2,        // TaskTypes.Transfer
  GetData = 3,         // TaskTypes.GetData
  BackendCall = 4,     // TaskTypes.BackendCall
  ClassifyProblem = 5  // TaskTypes.ClassifyProblem
}

/**
 * Helper: Deriva il tipo di editor da TaskType
 */
export function getEditorFromTaskType(type: TaskType): 'message' | 'ddt' | 'problem' | 'backend' | 'simple' {
  switch (type) {
    case TaskType.SayMessage:
    case TaskType.CloseSession:
    case TaskType.Transfer:
      return 'message';
    case TaskType.GetData:
      return 'ddt';
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
  type: TaskType;                // ✅ Enum numerato (comportamento: GetData, SayMessage, ecc.)
  name?: string;                 // ✅ Nome semantico (opzionale, per built-in: "GetData", "SayMessage")
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
 * - templateId = null → Task standalone (non referenzia altri Task)
 * - templateId = GUID → Task che referenzia un altro Task (per ereditare struttura/contratti)
 *
 * Esempi:
 * - Task DDT standalone: { id: "guid", templateId: null, label: "...", mainData: [...] }
 * - Task DDT che referenzia: { id: "guid", templateId: "guid-altro-task", label: "...", mainData: [...] }
 *
 * Per altri tipi di task (SayMessage, BackendCall, ecc.):
 * - Task standalone: { id: "guid", templateId: null, text: "Ciao!", ... }
 * - Task che referenzia: { id: "guid", templateId: "guid-altro-task", text: "Ciao!", ... }
 */
export interface Task {
  id: string;                    // Unique Task ID
  templateId: string | null;     // ✅ null = Task standalone, GUID = referenzia un altro Task
  // ✅ Campi diretti (niente wrapper value):
  // Per GetData/DDT:
  label?: string;                // Label del DDT
  mainData?: any[];              // Main data array
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

