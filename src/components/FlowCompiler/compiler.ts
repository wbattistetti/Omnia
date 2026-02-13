// Flow Compiler: Transforms flowchart + DDT into flat list of Tasks with conditions

import type { Node, Edge } from 'reactflow';
import type { FlowNode, EdgeData } from '../Flowchart/types/flowTypes';
import type { AssembledTaskTree } from '../TaskTreeBuilder/DDTAssembler/currentDDT.types';
import type { CompiledTask, CompilationResult, DDTExpansion } from './types';
import { buildFirstRowCondition, buildSequentialCondition } from './conditionBuilder';
import { expandDDT } from './ddtExpander';
import { taskRepository } from '../../services/TaskRepository';
import { getTemplateId } from '../../utils/taskHelpers';
import { templateIdToTaskType, TaskType } from '../../types/taskTypes';
// ✅ REMOVED: templateIdToVBAction - no longer needed, VB.NET uses templateId (string) directly

interface CompilerOptions {
  getTask: (taskId: string) => any; // Function to resolve Task from taskId
  getDDT?: (taskId: string) => AssembledTaskTree | null; // Function to get DDT for DataRequest tasks
}

/**
 * Compiles flowchart and DDT into flat list of tasks with conditions
 */
export function compileFlow(
  nodes: Node<FlowNode>[],
  edges: Edge<EdgeData>[],
  options: CompilerOptions
): CompilationResult {
  // ═══════════════════════════════════════════════════════════════════════════
  // 🎨 FRONTEND COMPILER - ENTRY POINT (OLD - da sostituire con backend)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('🎨 [FRONTEND] FlowCompiler.compileFlow() CALLED (OLD VERSION)');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('[FRONTEND] Compiler input:', {
    nodesCount: nodes.length,
    edgesCount: edges.length,
    nodeIds: nodes.map(n => n.id),
    hasGetTask: typeof options.getTask === 'function',
    hasGetDDT: typeof options.getDDT === 'function',
    timestamp: new Date().toISOString()
  });
  console.log('═══════════════════════════════════════════════════════════════════════════');

  const tasks: CompiledTask[] = [];
  const taskMap = new Map<string, CompiledTask>();
  const ddtExpansions = new Map<string, DDTExpansion>();

  // Find entry nodes (nodes without incoming edges)
  const entryNodes = nodes.filter(n =>
    !edges.some(e => e.target === n.id)
  );

  if (entryNodes.length === 0) {
    return { tasks, entryTaskId: null, taskMap };
  }

  // For now, use first entry node (TODO: prompt user if multiple)
  const entryNodeId = entryNodes[0].id;

  // Process all nodes
  for (const node of nodes) {
    const rows = node.data.rows || [];

    if (rows.length === 0) continue;

    console.log('[Compiler] 🔍 Processing node', {
      nodeId: node.id,
      rowsCount: rows.length,
      rows: rows.map(r => ({
        id: r.id,
        text: r.text,
        hasTaskId: !!r.taskId,
        taskId: r.taskId
      }))
    });

    // Process rows in sequence
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      // ✅ UNIFIED MODEL: row.id ALWAYS equals task.id (when task exists)
      const taskId = row.id;

      console.log('[Compiler] 🔍 Looking for task', {
        rowId: row.id,
        rowText: row.text,
        taskId: taskId, // ✅ row.id === task.id ALWAYS
      });

      // Resolve task
      const task = options.getTask(taskId);
      if (!task) {
        console.error('[Compiler] ❌ Task not found', {
          taskId,
          nodeId: node.id,
          rowId: row.id,
          rowText: row.text,
          allTasksInMemory: taskRepository.getAllTasks().map(t => ({ id: t.id, templateId: getTemplateId(t) }))
        });
        throw new Error(`[Compiler] Task not found: ${taskId} in node ${node.id}, row ${row.id}. Task must exist in memory.`);
      }

      // ✅ MIGRATION: Use getTemplateId() helper instead of direct task.action access
      const templateId = getTemplateId(task);

      console.log('[Compiler] ✅ Task found', {
        taskId: task.id,
        rowId: row.id,
        rowText: row.text,
        templateId: templateId
      });

      // Build condition
      let condition;
      if (rowIndex === 0) {
        // First row: condition based on node topology
        condition = buildFirstRowCondition(node.id, nodes, edges);
      } else {
        // Subsequent rows: previous row completed
        const prevRow = rows[rowIndex - 1];
        // ✅ UNIFIED MODEL: Use prevRow.taskId (NodeRowData.taskId is separate field)
        const prevTaskId = prevRow.taskId || prevRow.id;
        condition = buildSequentialCondition(prevTaskId);
      }

      // ✅ MIGRATION: Use getTemplateId() helper instead of direct task.action access
      const templateId = getTemplateId(task);

      // Create compiled task
      // Use row.id directly (which equals task.id) - no need to generate new ID
      const compiledTask: CompiledTask = {
        id: row.id, // row.id === task.id (GUID)
        action: templateId,  // ✅ DEPRECATED: Kept for backward compatibility
        templateId: templateId,  // ✅ Preferred field - matches VB.NET model
        // ✅ Campi diretti (niente wrapper value) - copia tutti i campi tranne id, templateId, createdAt, updatedAt
        ...Object.fromEntries(
          Object.entries(task).filter(([key]) =>
            !['id', 'templateId', 'createdAt', 'updatedAt'].includes(key)
          )
        ),
        condition,
        state: 'UnExecuted',
        source: {
          type: 'flowchart',
          nodeId: node.id,
          rowId: row.id
        }
      };

      tasks.push(compiledTask);
      taskMap.set(compiledTask.id, compiledTask);

      // ✅ MIGRATION: Use templateId instead of task.action
      // ✅ CASE-INSENSITIVE: If task is DataRequest, expand DDT
      // ✅ Check if task has DDT (data indicates DDT)
      if (templateId && templateIdToTaskType(templateId) === TaskType.UtteranceInterpretation && task.data && task.data.length > 0 && options.getDDT) {
        const ddt = options.getDDT(task.id);
        if (ddt) {
          const { tasks: ddtTasks, expansion } = expandDDT(
            ddt,
            node.id,
            options.getTask,
            templateId // ✅ Pass templateId instead of task.action
          );

          // Add DDT tasks to main list
          for (const ddtTask of ddtTasks) {
            tasks.push(ddtTask);
            taskMap.set(ddtTask.id, ddtTask);
          }

          ddtExpansions.set(node.id, expansion);
        }
      }

      // ✅ MIGRATION: Use templateId instead of task.action
      // If task is ClassifyProblem, expand DDT
      // ✅ CASE-INSENSITIVE
      // ✅ Check if task has DDT (data indicates DDT)
      if (templateId && templateId.toLowerCase() === 'classifyproblem' && task.data && task.data.length > 0 && options.getDDT) {
        const ddt = options.getDDT(task.id);
        if (ddt) {
          const { tasks: ddtTasks, expansion } = expandDDT(
            ddt,
            node.id,
            options.getTask,
            templateId // ✅ Pass templateId instead of task.action
          );

          // Add DDT tasks to main list
          for (const ddtTask of ddtTasks) {
            tasks.push(ddtTask);
            taskMap.set(ddtTask.id, ddtTask);
          }

          ddtExpansions.set(node.id, expansion);
        }
      }
    }
  }

  // Find entry task (first task of entry node)
  const entryNode = nodes.find(n => n.id === entryNodeId);
  const entryRow = entryNode?.data.rows?.[0];
  const entryTaskId = entryRow
    ? tasks.find(t => t.source.nodeId === entryNodeId && t.source.rowId === entryRow.id)?.id || null
    : null;

  const result = {
    tasks,
    entryTaskId,
    taskMap,
    translations: {} // ✅ Frontend compiler is deprecated - translations should come from backend compiler
  };

  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('✅ [FRONTEND] FlowCompiler.compileFlow() COMPLETED (OLD VERSION)');
  console.log('[FRONTEND] Compiler output:', {
    tasksCount: tasks.length,
    entryTaskId,
    taskMapSize: taskMap.size,
    timestamp: new Date().toISOString()
  });
  console.log('═══════════════════════════════════════════════════════════════════════════');

  return result;
}

/**
 * Finds entry nodes (nodes without incoming edges)
 * If multiple, returns all (UI should prompt user to choose)
 */
export function findEntryNodes(
  nodes: Node<FlowNode>[],
  edges: Edge<EdgeData>[]
): Node<FlowNode>[] {
  return nodes.filter(n => !edges.some(e => e.target === n.id));
}

