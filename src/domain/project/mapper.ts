// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { ProjectDomainModel, TaskDomainModel, FlowDomainModel, ConditionDomainModel, TemplateDomainModel, VariableDomainModel } from './model';
import type { Task } from '@types/taskTypes';
import type { Flow } from '@flows/FlowTypes';

/**
 * UI State structure (as used in AppContent.tsx)
 */
interface UIState {
  projectId: string;
  projectName?: string;
  flows: Record<string, Flow<any, any>>;
  tasks: Task[];
  conditions: any[];
  templates: any[];
  variables: any[];
  translations?: Record<string, Record<string, string>>;
  metadata?: {
    ownerCompany?: string;
    ownerClient?: string;
  };
}

/**
 * Maps UI state to stable domain model
 *
 * This function extracts the pure domain logic from React/UI state,
 * making it testable and deterministic.
 *
 * IMPORTANT: This function excludes orphan tasks (tasks not referenced in flows).
 * This is the key invariant that ensures data integrity.
 *
 * @param uiState - Current UI state (from AppContent.tsx, TaskRepository, etc.)
 * @returns Stable domain model
 */
export function mapUIStateToDomain(uiState: UIState): ProjectDomainModel {
  // Extract referenced task IDs from flows (to identify orphans)
  const referencedTaskIds = new Set<string>();

  Object.values(uiState.flows || {}).forEach((flow) => {
    if (flow?.nodes && Array.isArray(flow.nodes)) {
      flow.nodes.forEach((node: any) => {
        const nodeData = node.data;
        if (nodeData?.rows && Array.isArray(nodeData.rows)) {
          nodeData.rows.forEach((row: any) => {
            if (row.id) {
              referencedTaskIds.add(row.id);
            }
          });
        }
      });
    }
  });

  // Map tasks (only referenced ones, excluding orphans)
  const tasks: TaskDomainModel[] = (uiState.tasks || [])
    .filter((task) => referencedTaskIds.has(task.id))
    .map((task) => mapTaskToDomain(task));

  // Map flows
  const flows: FlowDomainModel[] = Object.values(uiState.flows || {}).map((flow) =>
    mapFlowToDomain(flow)
  );

  // Map conditions
  const conditions: ConditionDomainModel[] = (uiState.conditions || []).map((condition) =>
    mapConditionToDomain(condition)
  );

  // Map templates
  const templates: TemplateDomainModel[] = (uiState.templates || []).map((template) =>
    mapTemplateToDomain(template)
  );

  // Map variables
  const variables: VariableDomainModel[] = (uiState.variables || []).map((variable) =>
    mapVariableToDomain(variable)
  );

  return {
    id: uiState.projectId,
    name: uiState.projectName || '',
    tasks,
    flows,
    conditions,
    templates,
    variables,
    translations: uiState.translations,
    metadata: {
      createdAt: undefined, // Will be set by backend
      updatedAt: new Date().toISOString(),
      ownerCompany: uiState.metadata?.ownerCompany,
      ownerClient: uiState.metadata?.ownerClient,
    },
  };
}

/**
 * Maps a Task (UI type) to TaskDomainModel
 */
function mapTaskToDomain(task: Task): TaskDomainModel {
  return {
    id: task.id,
    type: task.type,
    templateId: task.templateId ?? null,
    templateVersion: task.templateVersion,
    source: task.source,
    labelKey: task.labelKey,
    subTasksIds: task.subTasksIds,
    steps: task.steps,
    introduction: task.introduction,
    intents: task.intents,
    endpoint: task.endpoint,
    method: task.method,
    params: task.params,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    // Preserve additional fields for backward compatibility
    ...Object.fromEntries(
      Object.entries(task).filter(([key]) =>
        !['id', 'type', 'templateId', 'templateVersion', 'source', 'labelKey',
          'subTasksIds', 'steps', 'introduction', 'intents', 'endpoint',
          'method', 'params', 'createdAt', 'updatedAt'].includes(key)
      )
    ),
  };
}

/**
 * Maps a Flow (UI type) to FlowDomainModel
 */
function mapFlowToDomain(flow: Flow<any, any>): FlowDomainModel {
  return {
    id: flow.id,
    title: flow.title || '',
    nodes: (flow.nodes || []).map((node: any) => ({
      id: node.id,
      type: node.type || 'default',
      position: node.position || { x: 0, y: 0 },
      data: {
        label: node.data?.label || '',
        rows: (node.data?.rows || []).map((row: any) => ({
          id: row.id,
          text: row.text || '',
          included: row.included,
          order: row.order,
        })),
        ...Object.fromEntries(
          Object.entries(node.data || {}).filter(([key]) =>
            !['label', 'rows'].includes(key)
          )
        ),
      },
    })),
    edges: (flow.edges || []).map((edge: any) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      conditionId: edge.data?.conditionId || edge.conditionId,
      ...Object.fromEntries(
        Object.entries(edge).filter(([key]) =>
          !['id', 'source', 'target', 'data', 'conditionId'].includes(key)
        )
      ),
    })),
    meta: flow.meta,
  };
}

/**
 * Maps a Condition (UI type) to ConditionDomainModel
 */
function mapConditionToDomain(condition: any): ConditionDomainModel {
  return {
    id: condition.id || condition._id,
    label: condition.label || condition.name || '',
    script: condition.script || condition.expression?.script || '',
    executableCode: condition.executableCode || condition.expression?.executableCode,
    compiledCode: condition.compiledCode || condition.expression?.compiledCode,
    variables: condition.variables || [],
    createdAt: condition.createdAt,
    updatedAt: condition.updatedAt,
  };
}

/**
 * Maps a Template (UI type) to TemplateDomainModel
 */
function mapTemplateToDomain(template: any): TemplateDomainModel {
  return {
    id: template.id || template._id,
    label: template.label || template.name || '',
    type: template.type || 0,
    source: template.source || 'Project',
    dataContract: template.dataContract,
    steps: template.steps,
    constraints: template.constraints,
    examples: template.examples,
    patterns: template.patterns,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    // Preserve additional fields for backward compatibility
    ...Object.fromEntries(
      Object.entries(template).filter(([key]) =>
        !['id', '_id', 'label', 'name', 'type', 'source', 'dataContract',
          'steps', 'constraints', 'examples', 'patterns', 'createdAt', 'updatedAt'].includes(key)
      )
    ),
  };
}

/**
 * Maps a VariableInstance (UI type) to VariableDomainModel
 *
 * VariableInstance structure:
 * - varId: GUID univoco
 * - varName: Nome leggibile
 * - taskInstanceId: ID dell'istanza task
 * - nodeId: GUID del nodo nel template
 * - ddtPath: Path nel DDT
 */
function mapVariableToDomain(variable: any): VariableDomainModel {
  // VariableInstance uses varId and varName, not id and name
  return {
    id: variable.varId || variable.id || variable._id,
    name: variable.varName || variable.name || '',
    type: variable.type || 'string',
    description: variable.description,
    defaultValue: variable.defaultValue,
    taskInstanceId: variable.taskInstanceId,
    nodeId: variable.nodeId,
    ddtPath: variable.ddtPath,
    createdAt: variable.createdAt,
    updatedAt: variable.updatedAt,
    // Preserve additional fields for backward compatibility
    ...Object.fromEntries(
      Object.entries(variable).filter(([key]) =>
        !['varId', 'varName', 'id', '_id', 'name', 'type', 'description',
          'defaultValue', 'taskInstanceId', 'nodeId', 'ddtPath', 'createdAt', 'updatedAt'].includes(key)
      )
    ),
  };
}

/**
 * Maps domain model back to UI state (for backward compatibility during migration)
 *
 * This is a temporary function for gradual migration.
 * Eventually, UI should work directly with domain models.
 */
export function mapDomainToUI(domain: ProjectDomainModel): Partial<UIState> {
  return {
    projectId: domain.id,
    projectName: domain.name,
    flows: domain.flows.reduce((acc, flow) => {
      acc[flow.id] = {
        id: flow.id,
        title: flow.title,
        nodes: flow.nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data,
        })),
        edges: flow.edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          data: { conditionId: edge.conditionId },
          conditionId: edge.conditionId,
        })),
        meta: flow.meta,
      };
      return acc;
    }, {} as Record<string, Flow<any, any>>),
    tasks: domain.tasks.map((task) => ({
      ...task,
    })) as Task[],
    conditions: domain.conditions.map((condition) => ({
      id: condition.id,
      label: condition.label,
      script: condition.script,
      executableCode: condition.executableCode,
      compiledCode: condition.compiledCode,
      variables: condition.variables,
      createdAt: condition.createdAt,
      updatedAt: condition.updatedAt,
    })),
    templates: domain.templates.map((template) => ({
      ...template,
    })),
    variables: domain.variables.map((variable) => ({
      ...variable,
    })),
    translations: domain.translations,
    metadata: domain.metadata,
  };
}
