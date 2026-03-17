// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { ProjectDomainModel } from '../../domain/project/model';
import type { SaveProjectRequest } from './SaveProjectRequest';
import type { SaveResult } from './SaveResult';

/**
 * ProjectSaveOrchestrator: Orchestrates project save flow
 * 
 * M2: This is a DRY-RUN version. It only prepares the save request,
 * but does not execute it. Execution will be added in M4.
 */
export class ProjectSaveOrchestrator {
  /**
   * Prepares save request from domain model (DRY-RUN)
   * 
   * This method transforms the domain model into the exact payload
   * structure expected by backend endpoints, but does NOT execute the save.
   * 
   * @param domain - Stable domain model
   * @param uiState - Additional UI state needed for save (flows, translations context, etc.)
   * @returns SaveProjectRequest ready to be sent to backend
   */
  prepareSave(
    domain: ProjectDomainModel,
    uiState: {
      flows: Record<string, any>; // FlowWorkspace flows
      translationsContext?: any; // translationsContext from window
      projectData?: any; // ProjectData for conditions
      allTemplates?: any[]; // All templates from DialogueTaskService
      variableService?: any; // VariableCreationService
    }
  ): SaveProjectRequest {
    // Get main flow (usually 'main')
    const mainFlowId = Object.keys(uiState.flows || {})[0] || 'main';
    const mainFlow = uiState.flows[mainFlowId];

    // Transform domain tasks to UI Task format (for backend compatibility)
    const tasksToSave = domain.tasks.map((task) => ({
      ...task,
    }));

    // Transform domain flow to UI Flow format
    const flowToSave = mainFlow ? {
      id: mainFlow.id || mainFlowId,
      title: mainFlow.title || domain.flows[0]?.title || 'Main Flow',
      nodes: mainFlow.nodes || [],
      edges: mainFlow.edges || [],
      meta: mainFlow.meta,
    } : null;

    // Transform domain conditions to backend format
    const conditionsToSave = domain.conditions.map((condition) => ({
      id: condition.id,
      label: condition.label,
      description: '', // TODO: Add description to ConditionDomainModel if needed
      expression: {
        script: condition.script,
        executableCode: condition.executableCode,
        compiledCode: condition.compiledCode,
      },
    }));

    // Transform domain templates to save format
    const templatesToSave: SaveProjectRequest['templates'] = [];
    
    // Get all templates from UI state (includes Factory templates with grammarFlow)
    const allTemplates = uiState.allTemplates || [];
    
    // Filter: Only save local templates (not Factory templates, not instances)
    const localTemplates = allTemplates.filter((t: any) => {
      const isFactory = t.source === 'Factory';
      const isInstance = t.templateId !== null && t.templateId !== undefined;
      return !isFactory && !isInstance;
    });

    localTemplates.forEach((template: any) => {
      const mongoId = template._id
        ? (typeof template._id === 'object' ? template._id.toString() : String(template._id))
        : template.id;
      
      templatesToSave.push({
        templateId: template.id,
        template: {
          ...template,
          updatedAt: new Date(),
        },
        isFactory: template.source === 'Factory',
        mongoId,
      });
    });

    // Transform domain variables to backend format
    const variablesToSave = domain.variables.map((variable) => ({
      ...variable,
    }));

    return {
      version: '1.0',
      projectId: domain.id,
      catalog: {
        projectId: domain.id,
        ownerCompany: domain.metadata?.ownerCompany || null,
        ownerClient: domain.metadata?.ownerClient || null,
      },
      tasks: {
        items: tasksToSave as any[], // Task[] format
        source: 'Project',
      },
      flow: flowToSave ? {
        flowId: mainFlowId,
        flow: flowToSave,
      } : {
        flowId: mainFlowId,
        flow: {
          id: mainFlowId,
          title: 'Main Flow',
          nodes: [],
          edges: [],
        },
      },
      variables: {
        projectId: domain.id,
        variables: variablesToSave,
      },
      templates: templatesToSave,
      conditions: {
        items: conditionsToSave,
      },
    };
  }

  /**
   * Validates save request before execution
   * 
   * @param request - Save request to validate
   * @returns Validation result
   */
  validateRequest(request: SaveProjectRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.projectId) {
      errors.push('projectId is required');
    }

    if (!request.tasks || !request.tasks.items) {
      errors.push('tasks.items is required');
    }

    if (!request.flow || !request.flow.flow) {
      errors.push('flow.flow is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
