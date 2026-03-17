// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { ProjectDomainModel } from '../../domain/project/model';
import type { SaveProjectRequest } from './SaveProjectRequest';
import type { SaveResult } from './SaveResult';
import type {
  ITaskRepository,
  IVariableService,
  IDialogueTaskService,
  IProjectDataService,
  ITranslationsContext,
  IFlowStateService,
} from './SaveServiceInterfaces';

/**
 * ProjectSaveOrchestrator: Orchestrates project save flow
 *
 * M5: Now includes executeSave() to actually persist data to backend.
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

    // ✅ SOLUTION 2: Save ALL Project templates (not Factory, not instances)
    // This ensures we don't lose templates referenced by orphan tasks
    // that are excluded from the bulk task save
    const localTemplates = allTemplates.filter((t: any) => {
      const isFactory = t.source === 'Factory';
      const isInstance = t.templateId !== null && t.templateId !== undefined;
      return !isFactory && !isInstance;
    });

    // Log filtering details for debugging
    if (allTemplates.length > 0) {
      const factoryTemplates = allTemplates.filter((t: any) => t.source === 'Factory');
      const projectTemplates = allTemplates.filter((t: any) => t.source !== 'Factory');
      const instances = allTemplates.filter((t: any) => t.templateId !== null && t.templateId !== undefined);

      console.log('[Save][Orchestrator] 📊 Template filtering (Solution 2: All Project templates)', {
        totalTemplates: allTemplates.length,
        factoryTemplates: factoryTemplates.length,
        projectTemplates: projectTemplates.length,
        instances: instances.length,
        localTemplatesToSave: localTemplates.length,
        note: 'Saving all Project templates (including those referenced by orphan tasks)',
      });
    }

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

  /**
   * Executes save request by calling all backend endpoints
   *
   * M5: This method orchestrates the actual save operations.
   * All operations run in parallel for better performance.
   *
   * @param request - Save request prepared by prepareSave()
   * @param uiState - Additional UI state needed for save (translations context, flow state, etc.)
   * @returns SaveResult with success status and details
   */
  async executeSave(
    request: SaveProjectRequest,
    uiState: {
      translationsContext?: ITranslationsContext;
      flowState?: IFlowStateService;
      taskRepository?: ITaskRepository;
      variableService?: IVariableService;
      dialogueTaskService?: IDialogueTaskService;
      projectDataService?: IProjectDataService;
      projectData?: any; // ProjectData for conditions (TODO: type this properly)
    }
  ): Promise<SaveResult> {
    const startTime = performance.now();
    const projectId = request.projectId;
    const results: SaveResult['results'] = {};
    const errors: string[] = [];

    console.log('[Save][Orchestrator] 🚀 START executeSave', { projectId });

    // Execute all save operations in parallel
    const savePromises = await Promise.allSettled([
      // 1. Catalog timestamp update
      (async () => {
        try {
          const response = await fetch('/api/projects/catalog/update-timestamp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request.catalog),
          });
          if (!response.ok) {
            throw new Error(`Catalog save failed: ${response.status} ${response.statusText}`);
          }
          results.catalog = { success: true };
          console.log('[Save][Orchestrator][1-catalog] ✅ DONE');
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Catalog: ${errorMsg}`);
          results.catalog = { success: false, error: errorMsg };
          console.error('[Save][Orchestrator][1-catalog] ❌ ERROR', { error: errorMsg });
        }
      })(),

      // 2. Translations
      (async () => {
        try {
          if (uiState.translationsContext?.saveAllTranslations) {
            await uiState.translationsContext.saveAllTranslations();
            results.translations = { success: true };
            console.log('[Save][Orchestrator][2-translations] ✅ DONE');
          } else {
            results.translations = { success: false, error: 'Translations context not available' };
            console.warn('[Save][Orchestrator][2-translations] ⚠️ Context not available');
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Translations: ${errorMsg}`);
          results.translations = { success: false, error: errorMsg };
          console.error('[Save][Orchestrator][2-translations] ❌ ERROR', { error: errorMsg });
        }
      })(),

      // 3. Flow
      (async () => {
        try {
          if (!uiState.flowState) {
            throw new Error('Flow state not provided');
          }

          // Flush flow persist queue
          if (uiState.flowState.flushFlowPersist) {
            await uiState.flowState.flushFlowPersist();
          }

          // Get flow data
          const mainFlow = uiState.flowState.getFlowById('main');
          const flowData = mainFlow
            ? { nodes: mainFlow.nodes, edges: mainFlow.edges }
            : { nodes: uiState.flowState.getNodes(), edges: uiState.flowState.getEdges() };

          // Transform to simplified format
          const simplifiedNodes = uiState.flowState.transformNodesToSimplified(flowData.nodes);
          const simplifiedEdges = uiState.flowState.transformEdgesToSimplified(flowData.edges);

          // Save flow
          const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/flow?flowId=main`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodes: simplifiedNodes, edges: simplifiedEdges }),
          });

          if (!response.ok) {
            throw new Error(`Flow save failed: ${response.status} ${response.statusText}`);
          }

          results.flow = { success: true };
          console.log('[Save][Orchestrator][3-flow] ✅ DONE');
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Flow: ${errorMsg}`);
          results.flow = { success: false, error: errorMsg };
          console.error('[Save][Orchestrator][3-flow] ❌ ERROR', { error: errorMsg });
        }
      })(),

      // 4. Tasks
      (async () => {
        try {
          if (!uiState.taskRepository) {
            throw new Error('TaskRepository not provided');
          }

          const saved = await uiState.taskRepository.saveAllTasksToDatabase(
            projectId,
            request.tasks.items
          );

          if (saved) {
            results.tasks = {
              success: true,
              saved: request.tasks.items.length,
              failed: 0,
            };
            console.log('[Save][Orchestrator][4-tasks] ✅ DONE', {
              saved: request.tasks.items.length,
            });
          } else {
            throw new Error('Task save returned false');
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Tasks: ${errorMsg}`);
          results.tasks = {
            success: false,
            saved: 0,
            failed: request.tasks.items.length,
            error: errorMsg,
          };
          console.error('[Save][Orchestrator][4-tasks] ❌ ERROR', { error: errorMsg });
        }
      })(),

      // 5. Variables
      (async () => {
        try {
          if (!uiState.variableService) {
            throw new Error('VariableService not provided');
          }

          const saved = await uiState.variableService.saveToDatabase(projectId);

          if (saved) {
            results.variables = {
              success: true,
              saved: request.variables.variables.length,
            };
            console.log('[Save][Orchestrator][5-variables] ✅ DONE', {
              saved: request.variables.variables.length,
            });
          } else {
            throw new Error('Variable save returned false');
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Variables: ${errorMsg}`);
          results.variables = {
            success: false,
            saved: 0,
            error: errorMsg,
          };
          console.error('[Save][Orchestrator][5-variables] ❌ ERROR', { error: errorMsg });
        }
      })(),

      // 6. Templates
      (async () => {
        try {
          if (!uiState.dialogueTaskService) {
            throw new Error('DialogueTaskService not provided');
          }

          // Save grammarFlow from store first
          await uiState.dialogueTaskService.saveAllGrammarFlowFromStore();

          // Mark all templates as modified
          request.templates.forEach((t) => {
            if (t.templateId) {
              uiState.dialogueTaskService.markTemplateAsModified(t.templateId);
            }
          });

          // Save all marked templates
          const result = await uiState.dialogueTaskService.saveModifiedTemplates(projectId);

          results.templates = {
            success: result.failed === 0,
            saved: result.saved,
            failed: result.failed,
            ...(result.failed > 0 ? { error: `${result.failed} templates failed to save` } : {}),
          };

          if (result.failed === 0) {
            console.log('[Save][Orchestrator][6-templates] ✅ DONE', {
              saved: result.saved,
            });
          } else {
            console.warn('[Save][Orchestrator][6-templates] ⚠️ PARTIAL', {
              saved: result.saved,
              failed: result.failed,
            });
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Templates: ${errorMsg}`);
          results.templates = {
            success: false,
            saved: 0,
            failed: request.templates.length,
            error: errorMsg,
          };
          console.error('[Save][Orchestrator][6-templates] ❌ ERROR', { error: errorMsg });
        }
      })(),

      // 7. Conditions
      (async () => {
        try {
          if (!uiState.projectDataService) {
            throw new Error('ProjectDataService not provided');
          }

          if (!uiState.projectData) {
            throw new Error('ProjectData not provided');
          }

          if (uiState.projectDataService?.saveProjectConditionsToDb) {
            await uiState.projectDataService.saveProjectConditionsToDb(
              projectId,
              uiState.projectData
            );
          } else {
            throw new Error('ProjectDataService.saveProjectConditionsToDb not available');
          }

          results.conditions = {
            success: true,
            saved: request.conditions.items.length,
          };
          console.log('[Save][Orchestrator][7-conditions] ✅ DONE', {
            saved: request.conditions.items.length,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Conditions: ${errorMsg}`);
          results.conditions = {
            success: false,
            saved: 0,
            error: errorMsg,
          };
          console.error('[Save][Orchestrator][7-conditions] ❌ ERROR', { error: errorMsg });
        }
      })(),
    ]);

    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    const allSuccess = Object.values(results).every((r) => r?.success !== false);
    const hasErrors = errors.length > 0;

    console.log('[Save][Orchestrator] ✅ executeSave COMPLETED', {
      projectId,
      duration,
      success: allSuccess,
      errorsCount: errors.length,
    });

    return {
      success: allSuccess && !hasErrors,
      projectId,
      duration,
      results,
      ...(hasErrors ? { errors } : {}),
    };
  }
}
