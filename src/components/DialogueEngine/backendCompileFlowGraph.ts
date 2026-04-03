/**
 * Builds POST /api/runtime/compile payload and returns parsed JSON for one flow canvas (main or subflow).
 * Shared by useDialogueEngine so subflow canvases compile with the same rules as main.
 */

import type { Node, Edge } from 'reactflow';
import type { FlowNode, EdgeData } from '../Flowchart/types/flowTypes';
import { enrichRowsWithTaskId, getTemplateId } from '../../utils/taskHelpers';
import { taskRepository } from '../../services/TaskRepository';
import { DialogueTaskService } from '../../services/DialogueTaskService';
import { taskTemplateService } from '../../services/TaskTemplateService';
import { templateIdToTaskType, TaskType } from '../../types/taskTypes';
import { buildMinimalAiAgentCompileTask } from '../TaskEditor/EditorHost/editors/aiAgentEditor/composeRuntimeRulesFromCompact';
import { readAiAgentRuntimeRulesVariant } from '../TaskEditor/EditorHost/editors/aiAgentEditor/aiAgentRuntimeRulesVariant';
import { FlowWorkspaceSnapshot } from '../../flows/FlowWorkspaceSnapshot';

const VB_COMPILE_URL = 'http://localhost:5000/api/runtime/compile';

/**
 * Resolves the child canvas id for a Subflow task: root `flowId`, `parameters[].flowId`, or `subflow_<task.id>`.
 * ApiServer DeserializeTaskFromJson requires `flowId` at task root for Subflow (see CompilationHandlers.vb).
 */
/**
 * Subflow id stored on the task (root or parameters only). Used for graph discovery so we do not
 * invent `subflow_<id>` canvases that were never opened/saved — those would fail nested compile.
 */
export function resolveSubflowFlowIdExplicitOnly(task: unknown): string {
  const t = task as Record<string, unknown> | null | undefined;
  if (!t) return '';
  const direct = typeof t.flowId === 'string' ? t.flowId.trim() : '';
  if (direct) return direct;
  const params = Array.isArray(t.parameters) ? t.parameters : [];
  const flowParam = params.find(
    (p: unknown) => String((p as { parameterId?: string }).parameterId || '').trim() === 'flowId'
  ) as { value?: string } | undefined;
  return String(flowParam?.value || '').trim();
}

export function resolveSubflowFlowIdFromTask(task: unknown): string {
  const explicit = resolveSubflowFlowIdExplicitOnly(task);
  if (explicit) return explicit;
  const t = task as Record<string, unknown> | null | undefined;
  const tid = String(t?.id || '').trim();
  if (tid) return `subflow_${tid}`;
  return '';
}

export type BackendCompileFlowContext = {
  projectData: unknown;
  translations: Record<string, string>;
};

export type BackendCompileFlowArtifacts = {
  compileJson: Record<string, unknown>;
  allTasksWithTemplates: unknown[];
  allDDTs: unknown[];
};

function collectSubflowFlowIdsFromEnrichedNodes(nodes: Node<FlowNode>[]): string[] {
  const out = new Set<string>();
  for (const node of nodes) {
    const rows = node.data?.rows || [];
    for (const row of rows) {
      const taskId = row.id || row.taskId;
      if (!taskId) continue;
      const task = taskRepository.getTask(taskId);
      if (task?.type === TaskType.Subflow) {
        const fid = resolveSubflowFlowIdExplicitOnly(task);
        if (fid && fid !== 'main') {
          out.add(fid);
        }
      }
    }
  }
  return Array.from(out);
}

/**
 * All subflow canvas ids reachable from a root flow graph (transitive closure over Subflow tasks).
 */
export function discoverSubflowCanvasIdsTransitively(seedEnrichedNodes: Node<FlowNode>[]): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const stack = [...collectSubflowFlowIdsFromEnrichedNodes(seedEnrichedNodes)];

  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);

    const snap = FlowWorkspaceSnapshot.getFlowById(id);
    if (!snap?.nodes?.length) continue;

    const enriched = snap.nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        rows: enrichRowsWithTaskId(node.data?.rows || []),
      },
    }));

    for (const nested of collectSubflowFlowIdsFromEnrichedNodes(enriched)) {
      if (!seen.has(nested)) stack.push(nested);
    }
  }

  return ordered;
}

/** @deprecated Use discoverSubflowCanvasIdsTransitively (same behaviour, clearer name). */
export function discoverAllSubflowCanvasIds(mainEnrichedNodes: Node<FlowNode>[]): string[] {
  return discoverSubflowCanvasIdsTransitively(mainEnrichedNodes);
}

export async function backendCompileFlowGraph(
  enrichedNodes: Node<FlowNode>[],
  edges: Edge<EdgeData>[],
  ctx: BackendCompileFlowContext
): Promise<BackendCompileFlowArtifacts> {
  const { projectData, translations } = ctx;

  const referencedTaskIds = new Set<string>();
  enrichedNodes.forEach((node) => {
    const rows = node.data?.rows || [];
    rows.forEach((row: { id?: string }) => {
      if (row.id) referencedTaskIds.add(row.id);
    });
  });

  const referencedInstances = Array.from(referencedTaskIds)
    .map((taskId) => {
      const task = taskRepository.getTask(taskId);
      if (!task) {
        console.warn(`[backendCompileFlowGraph] Task ${taskId} not found in TaskRepository`);
        return null;
      }
      if (task.type === undefined || task.type === null) {
        console.error(`[backendCompileFlowGraph] Task ${task.id} has no type — skipping.`);
        return null;
      }
      return task;
    })
    .filter((t): t is Record<string, unknown> => t !== null);

  if (!DialogueTaskService.isCacheLoaded()) {
    await DialogueTaskService.loadTemplates();
  }

  const collectedTemplateIds = new Set<string>();

  const collectTemplateIdsRecursive = (task: Record<string, unknown> | null | undefined) => {
    if (!task) return;
    const templateId = getTemplateId(task as Parameters<typeof getTemplateId>[0]);
    if (templateId && !collectedTemplateIds.has(templateId)) {
      collectedTemplateIds.add(templateId);
      let template = DialogueTaskService.getTemplate(templateId);
      if (!template) {
        const allTemplates = DialogueTaskService.getAllTemplates();
        template = allTemplates.find((t) => t.id === templateId) || null;
      }
      if (template) collectTemplateIdsRecursive(template as Record<string, unknown>);
    }
    const subIds = task.subTasksIds as string[] | undefined;
    if (subIds && Array.isArray(subIds)) {
      subIds.forEach((subTaskId: string) => {
        if (subTaskId && !collectedTemplateIds.has(subTaskId)) {
          collectedTemplateIds.add(subTaskId);
          let subTemplate = DialogueTaskService.getTemplate(subTaskId);
          if (!subTemplate) {
            const allTemplates = DialogueTaskService.getAllTemplates();
            subTemplate = allTemplates.find((t) => t.id === subTaskId) || null;
          }
          if (subTemplate) collectTemplateIdsRecursive(subTemplate as Record<string, unknown>);
        }
      });
    }
  };

  referencedInstances.forEach((instance) => collectTemplateIdsRecursive(instance));

  const referencedTemplates: unknown[] = [];
  const loadedTemplateIds = new Set<string>();
  const allDialogueTaskServiceTemplates = DialogueTaskService.getAllTemplates();

  Array.from(collectedTemplateIds).forEach((templateId) => {
    let template = DialogueTaskService.getTemplate(templateId);
    if (!template) {
      template = allDialogueTaskServiceTemplates.find((t) => t.id === templateId) || null;
    }
    if (template) {
      const source = (template as { source?: string }).source;
      if (source !== 'Factory') {
        referencedTemplates.push(template);
        loadedTemplateIds.add(templateId);
      }
    }
  });

  const factoryTemplateIds = Array.from(collectedTemplateIds).filter((id) => !loadedTemplateIds.has(id));
  if (factoryTemplateIds.length > 0) {
    const allFactoryTemplatesRaw = await taskTemplateService.getAllTemplates();
    factoryTemplateIds.forEach((templateId) => {
      const factoryTemplate = allFactoryTemplatesRaw.find((t) => t.id === templateId);
      if (factoryTemplate) {
        const factoryTemplateAny = factoryTemplate as Record<string, unknown>;
        referencedTemplates.push({
          id: factoryTemplate.id,
          label: factoryTemplate.label,
          type: factoryTemplate.type,
          name: factoryTemplateAny.name,
          dataContract:
            factoryTemplateAny.nlpContract ||
            factoryTemplateAny.dataContract ||
            factoryTemplateAny.semanticContract ||
            null,
          semanticContract: factoryTemplateAny.semanticContract,
          ...factoryTemplateAny,
        });
      }
    });
  }

  const allTasksWithTemplates = [...referencedInstances, ...referencedTemplates];
  const aiAgentRulesVariant = readAiAgentRuntimeRulesVariant();
  const tasksForCompile = allTasksWithTemplates.map((t: Record<string, unknown>) => {
    if (t.type === TaskType.AIAgent) {
      return buildMinimalAiAgentCompileTask(t as Parameters<typeof buildMinimalAiAgentCompileTask>[0], {
        rulesVariant: aiAgentRulesVariant,
      });
    }
    if (t.type === TaskType.Subflow) {
      const fid = resolveSubflowFlowIdFromTask(t);
      if (fid) {
        return { ...t, flowId: fid };
      }
    }
    return t;
  });

  const allDDTs: unknown[] = [];
  let buildTaskTree: ((task: unknown, projectId?: string) => Promise<unknown>) | null = null;
  try {
    const taskUtilsModule = await import('../../utils/taskUtils');
    buildTaskTree = taskUtilsModule.buildTaskTree as (task: unknown, projectId?: string) => Promise<unknown>;
  } catch (importError) {
    console.error('[backendCompileFlowGraph] Failed to import buildTaskTree', importError);
  }

  if (buildTaskTree) {
    const projectId = localStorage.getItem('currentProjectId') || undefined;
    for (const taskId of Array.from(referencedTaskIds)) {
      const task = taskRepository.getTask(taskId);
      if (!task) continue;
      const templateId = getTemplateId(task);
      if (!templateId || templateIdToTaskType(templateId) !== TaskType.UtteranceInterpretation) continue;
      try {
        const taskTree = (await buildTaskTree(task, projectId)) as {
          nodes?: unknown[];
          steps?: unknown;
        } | null;
        if (!taskTree?.nodes?.length) {
          if (task.data && Array.isArray(task.data) && task.data.length > 0) {
            allDDTs.push({
              label: task.label,
              data: task.data,
              steps: task.steps,
            });
          }
          continue;
        }
        const nodesWithUserData = taskTree.nodes.map((node: Record<string, unknown>) => {
          const userNode = (task.data as unknown[] | undefined)?.find(
            (d: Record<string, unknown>) =>
              d.templateId === node.templateId || d.id === node.id || d.templateId === node.id
          ) as Record<string, unknown> | undefined;
          if (userNode) {
            return { ...node, ...userNode, id: node.id, templateId: node.templateId };
          }
          return node;
        });
        allDDTs.push({
          label: task.label,
          data: nodesWithUserData,
          steps: taskTree.steps || task.steps,
        });
      } catch {
        if (task.data && Array.isArray(task.data) && task.data.length > 0) {
          allDDTs.push({
            label: task.label,
            data: task.data,
            steps: task.steps,
          });
        }
      }
    }
  } else {
    Array.from(referencedTaskIds).forEach((taskId) => {
      const task = taskRepository.getTask(taskId);
      if (task?.data && Array.isArray(task.data) && task.data.length > 0) {
        const templateId = getTemplateId(task);
        if (templateId && templateIdToTaskType(templateId) === TaskType.UtteranceInterpretation) {
          allDDTs.push({
            label: task.label,
            data: task.data,
            steps: task.steps,
          });
        }
      }
    });
  }

  const { transformNodesToSimplified } = await import('../../flows/flowTransformers');
  const simplifiedNodes = transformNodesToSimplified(enrichedNodes);
  const nodesWithTaskId = simplifiedNodes.map((node: Record<string, unknown>) => ({
    ...node,
    rows: ((node.rows as unknown[]) || []).map((row: Record<string, unknown>) => ({
      ...row,
      taskId: row.taskId || row.id,
    })),
  }));

  const referencedConditionIds = new Set(
    (edges || []).map((e) => (e as { conditionId?: string }).conditionId).filter(Boolean) as string[]
  );

  const pd = projectData as {
    conditions?: Array<{ items?: Array<Record<string, unknown>> }>;
  } | null;
  const conditions =
    pd?.conditions
      ?.flatMap((cat) => cat.items || [])
      .filter((item) => {
        const itemId = (item.id || item._id) as string;
        return itemId && referencedConditionIds.has(itemId);
      })
      .map((item) => ({
        id: item.id || item._id,
        name: item.name || item.label,
        label: item.label || item.name,
        expression: {
          executableCode: (item.expression as { executableCode?: string })?.executableCode || '',
          compiledCode: (item.expression as { compiledCode?: string })?.compiledCode || '',
          ast: (item.expression as { ast?: string })?.ast || '',
          format: (item.expression as { format?: string })?.format || 'dsl',
        },
      })) ?? [];

  const validNodeIds = new Set(nodesWithTaskId.map((n: { id: string }) => n.id));
  const filteredEdges = (edges || []).filter((e) => {
    const ex = e as { source: string; target: string; id?: string };
    if (!validNodeIds.has(ex.target) || !validNodeIds.has(ex.source)) return false;
    const targetNode = nodesWithTaskId.find((n: { id: string }) => n.id === ex.target) as
      | { data?: { hidden?: boolean; isTemporary?: boolean } }
      | undefined;
    const sourceNode = nodesWithTaskId.find((n: { id: string }) => n.id === ex.source) as
      | { data?: { hidden?: boolean; isTemporary?: boolean } }
      | undefined;
    if (targetNode?.data?.hidden || targetNode?.data?.isTemporary) return false;
    if (sourceNode?.data?.hidden || sourceNode?.data?.isTemporary) return false;
    return true;
  });

  const { variableCreationService } = await import('../../services/VariableCreationService');
  const { getSafeProjectId } = await import('../../utils/safeProjectId');
  const projectId = getSafeProjectId();
  const variables = variableCreationService.getAllVariables(projectId);

  const requestBody = {
    nodes: nodesWithTaskId,
    edges: filteredEdges,
    tasks: tasksForCompile,
    ddts: allDDTs,
    projectId,
    translations,
    conditions,
    variables,
  };

  const compileResponse = await fetch(VB_COMPILE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!compileResponse.ok) {
    const errorText = await compileResponse.text().catch(() => 'Unable to read error response');
    let errorData: Record<string, unknown> = { error: 'Unknown error' };
    try {
      errorData = JSON.parse(errorText) as Record<string, unknown>;
    } catch {
      errorData = { error: errorText || 'Unknown error' };
    }
    throw new Error(
      `Backend compilation failed: ${String(errorData.message || errorData.error || errorData.detail || compileResponse.statusText)}`
    );
  }

  const responseText = await compileResponse.text();
  if (!responseText?.trim()) {
    throw new Error('Backend returned empty compile response');
  }

  let compileJson: Record<string, unknown>;
  try {
    compileJson = JSON.parse(responseText) as Record<string, unknown>;
  } catch (parseError) {
    throw new Error(
      `Failed to parse compile response: ${parseError instanceof Error ? parseError.message : String(parseError)}`
    );
  }

  return {
    compileJson,
    allTasksWithTemplates,
    allDDTs,
  };
}
