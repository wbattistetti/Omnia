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
import { logFlowSaveDebug } from '../../utils/flowSaveDebug';
import type { WorkspaceState } from '../../flows/FlowTypes';
import { buildFlowDocumentFromFlowSlice } from '../../domain/flowDocument/flowDocumentSerialize';
import { saveFlowDocument } from '../../flows/flowDocumentPersistence';

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
   * Executes save request by calling all backend endpoints.
   *
   * Deterministic persistence: project template definitions are saved via DialogueTaskService
   * (POST /templates) before task bulk, so the same Mongo `id` is never overwritten by a
   * competing bulk payload. Catalog/flow/translations/variables/conditions still run in parallel.
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
      /**
       * Snapshot of all workspace flows (FlowStore): one PUT /flow-document per flow id.
       * When omitted, only `main` is saved.
       * `meta` (flow interface, translations) is embedded in the FlowDocument.
       */
      flowsById?: Record<
        string,
        {
          nodes?: unknown[];
          edges?: unknown[];
          meta?: { flowInterface?: unknown; createdAt?: string; updatedAt?: string; fromTaskId?: string };
          /** Step 3: when explicitly false, skip PUT for this flow (no local graph changes). */
          hasLocalChanges?: boolean;
        }
      >;
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

    // Phase 1: parallel — everything except tasks bulk and template save (see phase 2/3).
    const phase1Promises = await Promise.allSettled([
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

      // 3. Flow (all workspace flows when flowsById is provided; otherwise main only)
      (async () => {
        try {
          if (!uiState.flowState) {
            throw new Error('Flow state not provided');
          }

          // Flush flow persist queue
          if (uiState.flowState.flushFlowPersist) {
            await uiState.flowState.flushFlowPersist();
          }

          const fs = uiState.flowState;
          const snapshot = uiState.flowsById;
          const snapshotKeys = snapshot && Object.keys(snapshot).length > 0 ? Object.keys(snapshot) : null;
          const flowIds = snapshotKeys
            ? (() => {
                const idSet = new Set<string>(snapshotKeys);
                idSet.add('main');
                const merged = Array.from(idSet);
                return merged.includes('main')
                  ? ['main', ...merged.filter((id) => id !== 'main').sort()]
                  : merged.sort();
              })()
            : ['main'];

          const persistedFlowIds: string[] = [];

          const flowsLike = {} as WorkspaceState['flows'];
          for (const fid of flowIds) {
            const e = snapshot?.[fid];
            if (e && typeof e === 'object') {
              flowsLike[fid] = {
                id: fid,
                title: String((e as { title?: string }).title || fid).trim() || fid,
                nodes: (e as { nodes?: unknown[] }).nodes ?? [],
                edges: (e as { edges?: unknown[] }).edges ?? [],
                meta: (e as { meta?: unknown }).meta,
                hydrated: (e as { hydrated?: boolean }).hydrated,
                hasLocalChanges: (e as { hasLocalChanges?: boolean }).hasLocalChanges,
              } as WorkspaceState['flows'][string];
            } else if (fid === 'main') {
              const mainFlow = fs.getFlowById('main');
              if (mainFlow) {
                flowsLike[fid] = {
                  id: 'main',
                  title: 'Main',
                  nodes: mainFlow.nodes ?? [],
                  edges: mainFlow.edges ?? [],
                } as WorkspaceState['flows'][string];
              }
            }
          }

          for (const flowId of flowIds) {
            let flowData: { nodes: any[]; edges: any[] };
            if (snapshot && Object.prototype.hasOwnProperty.call(snapshot, flowId)) {
              const entry = snapshot[flowId];
              const nodeCount = (entry?.nodes as any[])?.length ?? 0;
              const edgeCount = (entry?.edges as any[])?.length ?? 0;
              const hasGraph = nodeCount > 0 || edgeCount > 0;
              // Step 3: skip only when explicitly synced AND nothing to persist. Never skip when the snapshot
              // has nodes/edges (e.g. draft→first save with hasLocalChanges still false on main).
              if (
                entry &&
                typeof entry === 'object' &&
                'hasLocalChanges' in entry &&
                entry.hasLocalChanges === false &&
                !hasGraph
              ) {
                logFlowSaveDebug('orchestrator: skip flow PUT (no local changes, empty graph)', {
                  flowId,
                  nodeCount,
                  edgeCount,
                  hasLocalChanges: entry.hasLocalChanges,
                });
                continue;
              }
              flowData = {
                nodes: (entry?.nodes as any[]) || [],
                edges: (entry?.edges as any[]) || [],
              };
            } else if (flowId === 'main') {
              const mainFlow = fs.getFlowById('main');
              flowData = mainFlow
                ? { nodes: mainFlow.nodes, edges: mainFlow.edges }
                : { nodes: fs.getNodes(), edges: fs.getEdges() };
            } else {
              continue;
            }

            if (!flowsLike[flowId]) {
              flowsLike[flowId] = {
                id: flowId,
                title: flowId,
                nodes: flowData.nodes,
                edges: flowData.edges,
              } as WorkspaceState['flows'][string];
            }

            const doc = buildFlowDocumentFromFlowSlice(projectId, flowId, flowsLike, flowData.nodes, flowData.edges);

            logFlowSaveDebug('orchestrator: PUT /flow-document', {
              flowId,
              rawNodeCount: flowData.nodes?.length ?? 0,
              rawEdgeCount: flowData.edges?.length ?? 0,
              taskCount: doc.tasks.length,
              variableCount: doc.variables.length,
            });

            await saveFlowDocument(doc);
            persistedFlowIds.push(flowId);
          }

          results.flow = { success: true, persistedFlowIds };
          console.log('[Save][Orchestrator][3-flow] ✅ DONE', { flowCount: flowIds.length, persistedFlowIds });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Flow: ${errorMsg}`);
          results.flow = { success: false, error: errorMsg };
          console.error('[Save][Orchestrator][3-flow] ❌ ERROR', { error: errorMsg });
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

    // Phase 2: project templates (full dataContract from DialogueTaskService) — before task bulk.
    try {
      if (!uiState.dialogueTaskService) {
        throw new Error('DialogueTaskService not provided');
      }

      await uiState.dialogueTaskService.saveAllGrammarFlowFromStore();

      request.templates.forEach((t) => {
        if (t.templateId) {
          uiState.dialogueTaskService.markTemplateAsModified(t.templateId);
        }
      });

      const templateResult = await uiState.dialogueTaskService.saveModifiedTemplates(projectId);

      results.templates = {
        success: templateResult.failed === 0,
        saved: templateResult.saved,
        failed: templateResult.failed,
        ...(templateResult.failed > 0 ? { error: `${templateResult.failed} templates failed to save` } : {}),
      };

      if (templateResult.failed === 0) {
        console.log('[Save][Orchestrator][6-templates] ✅ DONE', {
          saved: templateResult.saved,
        });
      } else {
        console.warn('[Save][Orchestrator][6-templates] ⚠️ PARTIAL', {
          saved: templateResult.saved,
          failed: templateResult.failed,
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

    // Phase 3: task bulk (instances + standalone; project template definitions excluded in TaskRepository).
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
