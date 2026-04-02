// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { TaskType, type SemanticValue } from '@types/taskTypes';

/**
 * ProjectDomainModel: Stable domain model for project data
 *
 * INVARIANTS:
 * - No orphan tasks (all tasks must be referenced in flows)
 * - No conditions with missing variables
 * - No templates without language
 * - No flow edges pointing to non-existent tasks
 * - No grammar nodes without label (unless explicitly allowed)
 */
export interface ProjectDomainModel {
  id: string;
  name: string;
  tasks: TaskDomainModel[];
  flows: FlowDomainModel[];
  conditions: ConditionDomainModel[];
  templates: TemplateDomainModel[];
  variables: VariableDomainModel[];
  translations?: Record<string, Record<string, string>>;
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    ownerCompany?: string;
    ownerClient?: string;
  };
}

/**
 * TaskDomainModel: Pure domain representation of a task
 *
 * INVARIANTS:
 * - id must be unique within project
 * - type must be valid TaskType enum
 * - templateId must reference existing template (if not null)
 */
export interface TaskDomainModel {
  id: string;
  type: TaskType;
  templateId: string | null;
  templateVersion?: number;
  source?: 'Project' | 'Factory';
  labelKey?: string;
  subTasksIds?: string[];
  steps?: Record<string, Record<string, any>>;
  introduction?: any;
  semanticValues?: SemanticValue[] | null;
  endpoint?: string;
  method?: string;
  params?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any; // Allow additional fields for backward compatibility
}

/**
 * FlowDomainModel: Pure domain representation of a flow
 *
 * INVARIANTS:
 * - All node rows must reference existing tasks (row.id === task.id)
 * - No edges pointing to non-existent nodes
 * - No edges pointing to non-existent tasks
 */
export interface FlowDomainModel {
  id: string;
  title: string;
  nodes: FlowNodeDomainModel[];
  edges: FlowEdgeDomainModel[];
  meta?: {
    createdAt?: string;
    updatedAt?: string;
    fromTaskId?: string;
  };
}

/**
 * FlowNodeDomainModel: Node in a flow
 */
export interface FlowNodeDomainModel {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    rows: FlowRowDomainModel[];
    [key: string]: any;
  };
}

/**
 * FlowRowDomainModel: Row in a flow node
 *
 * INVARIANTS:
 * - id must match task.id if task exists
 */
export interface FlowRowDomainModel {
  id: string; // Must equal task.id when task exists
  text: string;
  included?: boolean;
  order?: number;
}

/**
 * FlowEdgeDomainModel: Edge in a flow
 *
 * INVARIANTS:
 * - source and target must reference existing nodes
 * - conditionId (if present) must reference existing condition
 */
export interface FlowEdgeDomainModel {
  id: string;
  source: string; // Node ID
  target: string; // Node ID
  conditionId?: string; // Condition ID (if edge is conditional)
  [key: string]: any;
}

/**
 * ConditionDomainModel: Pure domain representation of a condition
 *
 * INVARIANTS:
 * - All referenced variables must exist in project variables
 * - Script must be valid (syntax check)
 */
export interface ConditionDomainModel {
  id: string;
  label: string;
  script: string;
  executableCode?: string;
  compiledCode?: string;
  variables?: string[]; // Referenced variable IDs
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * TemplateDomainModel: Pure domain representation of a template
 *
 * INVARIANTS:
 * - Must have at least one language
 * - dataContract.engines must be valid array
 */
export interface TemplateDomainModel {
  id: string;
  label: string;
  type: TaskType;
  source: 'Project' | 'Factory';
  dataContract?: {
    engines?: EngineConfigDomainModel[];
    [key: string]: any;
  };
  steps?: Record<string, Record<string, any>>;
  constraints?: any[];
  examples?: any[];
  patterns?: {
    IT?: string[];
    EN?: string[];
    PT?: string[];
  };
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
}

/**
 * EngineConfigDomainModel: Engine configuration in template
 */
export interface EngineConfigDomainModel {
  type: 'regex' | 'llm' | 'grammarflow' | string;
  grammarFlow?: any; // Grammar flow object (if type === 'grammarflow')
  [key: string]: any;
}

/**
 * VariableDomainModel: Pure domain representation of a variable
 *
 * Maps from VariableInstance (id = TaskTreeNode GUID, varName, dataPath).
 */
export interface VariableDomainModel {
  id: string;
  name: string; // Maps from varName (human-readable)
  type?: string;
  description?: string;
  defaultValue?: any;
  taskInstanceId?: string;
  dataPath?: string;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
}
