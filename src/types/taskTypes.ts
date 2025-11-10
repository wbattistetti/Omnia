// New Task-based model types
// These types are added alongside existing types for gradual migration

/**
 * TaskTemplate: Defines a type of executable task
 * Replaces: AgentActs, Action Catalog entries
 */
export interface TaskTemplate {
  id: string;                    // Template ID (e.g. "SayMessage", "GetData", "callBackend")
  label: string;                 // Display label
  description: string;           // Description
  icon: string;                  // Icon name (e.g. "MessageCircle", "HelpCircle")
  color: string;                 // UI color (e.g. "text-blue-500")

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

  // ValueSchema: Defines the structure of Task.value and which editor to use
  valueSchema: {                 // Defines Task.value structure
    editor: 'message' | 'ddt' | 'problem' | 'backend' | 'simple';  // Which editor to open
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

  scope?: 'global' | 'industry' | 'client';  // Scope del template
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
 * Task: Executable instance of a TaskTemplate
 * Replaces: ActInstance
 * Relationship: 1:1 with FlowRow (each row has one unique Task)
 */
export interface Task {
  id: string;                    // Unique Task ID (instance ID)
  action: string;                // TaskTemplate ID (e.g. "SayMessage", "GetData")
  value?: Record<string, any>;   // Generic key-value data, structured according to template's valueSchema
  createdAt?: Date;
  updatedAt?: Date;
}

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

