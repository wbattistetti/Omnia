// Flow Compiler: Transforms flowchart + DDT into flat list of Tasks with conditions

import type { Node, Edge } from 'reactflow';
import type { NodeData, EdgeData } from '../Flowchart/types/flowTypes';
import type { AssembledDDT } from '../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import type { CompiledTask, CompilationResult, DDTExpansion } from './types';
import { buildFirstRowCondition, buildSequentialCondition } from './conditionBuilder';
import { expandDDT } from './ddtExpander';

interface CompilerOptions {
  getTask: (taskId: string) => any; // Function to resolve Task from taskId
  getDDT?: (taskId: string) => AssembledDDT | null; // Function to get DDT for GetData tasks
}

/**
 * Compiles flowchart and DDT into flat list of tasks with conditions
 */
export function compileFlow(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  options: CompilerOptions
): CompilationResult {
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

    // Process rows in sequence
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const taskId = row.id; // Always use row.id (rule: row.id === task.id)

      // Resolve task
      const task = options.getTask(taskId);
      if (!task) {
        throw new Error(`[Compiler] Task not found: ${taskId} in node ${node.id}, row ${row.id}. Task must exist in memory.`);
      }

      // Build condition
      let condition;
      if (rowIndex === 0) {
        // First row: condition based on node topology
        condition = buildFirstRowCondition(node.id, nodes, edges);
      } else {
        // Subsequent rows: previous row completed
        const prevRow = rows[rowIndex - 1];
        const prevTaskId = prevRow.id; // Always use row.id (rule: row.id === task.id)
        condition = buildSequentialCondition(prevTaskId);
      }

      // Create compiled task
      // Use row.id directly (which equals task.id) - no need to generate new ID
      const compiledTask: CompiledTask = {
        id: row.id, // row.id === task.id (GUID)
        action: task.action,
        value: task.value || {},
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

      // If task is GetData, expand DDT
      if (task.action === 'GetData' && task.value?.ddt && options.getDDT) {
        const ddt = options.getDDT(task.id);
        if (ddt) {
          const { tasks: ddtTasks, expansion } = expandDDT(
            ddt,
            node.id,
            options.getTask,
            task.action // Pass parent row action type
          );

          // Add DDT tasks to main list
          for (const ddtTask of ddtTasks) {
            tasks.push(ddtTask);
            taskMap.set(ddtTask.id, ddtTask);
          }

          ddtExpansions.set(node.id, expansion);
        }
      }

      // If task is ClassifyProblem, expand DDT
      if (task.action === 'ClassifyProblem' && task.value?.ddt && options.getDDT) {
        const ddt = options.getDDT(task.id);
        if (ddt) {
          const { tasks: ddtTasks, expansion } = expandDDT(
            ddt,
            node.id,
            options.getTask,
            task.action // Pass parent row action type
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

  return {
    tasks,
    entryTaskId,
    taskMap
  };
}

/**
 * Finds entry nodes (nodes without incoming edges)
 * If multiple, returns all (UI should prompt user to choose)
 */
export function findEntryNodes(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[]
): Node<NodeData>[] {
  return nodes.filter(n => !edges.some(e => e.target === n.id));
}

