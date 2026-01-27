// Flow Compiler: Transforms flowchart + DDT into flat list of Tasks with conditions

import type { FlowNode, FlowEdge, NodeData, AssembledDDT } from '../types';
import type { CompiledTask, CompilationResult, DDTExpansion } from './types';
import { buildFirstRowCondition, buildSequentialCondition } from './conditionBuilder';
import { expandDDT } from './ddtExpander';

/**
 * Extracts all translation keys (GUIDs) from a task
 * Translation keys are found in:
 * - task.parameters where parameterId === 'text' and value is a GUID
 * - task.id (GUID of the task instance)
 */
function extractTranslationKeysFromTask(task: any): Set<string> {
  const keys = new Set<string>();
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Extract from task.id (GUID of the task instance)
  if (task.id && guidPattern.test(task.id)) {
    keys.add(task.id);
  }

  // Extract from parameters
  if (task.parameters && Array.isArray(task.parameters)) {
    for (const param of task.parameters) {
      // Look for text parameter with GUID value
      if ((param.parameterId === 'text' || param.key === 'text') && param.value) {
        if (guidPattern.test(param.value)) {
          keys.add(param.value);
        }
      }
    }
  }

  // Also check task.params.text (alternative structure)
  if (task.params?.text && guidPattern.test(task.params.text)) {
    keys.add(task.params.text);
  }

  return keys;
}

/**
 * Extracts all translation keys (GUIDs) from a DDT structure
 * Translation keys are found in:
 * - node.messages[stepKey].textKey
 * - task.id (GUID of the task instance)
 * - task.parameters where parameterId === 'text' and value is a GUID
 */
function extractTranslationKeysFromDDT(ddt: AssembledDDT | null): Set<string> {
  const keys = new Set<string>();
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!ddt || !ddt.mainData) {
    return keys;
  }

  const processNode = (node: any) => {
    // Extract from messages
    if (node.messages) {
      Object.values(node.messages).forEach((msg: any) => {
        if (msg?.textKey && guidPattern.test(msg.textKey)) {
          keys.add(msg.textKey);
        }
      });
    }

    // Extract from steps and escalations
    if (node.steps) {
      Object.values(node.steps).forEach((step: any) => {
        if (step?.escalations && Array.isArray(step.escalations)) {
          step.escalations.forEach((esc: any) => {
            if (esc?.tasks && Array.isArray(esc.tasks)) {
              esc.tasks.forEach((task: any) => {
                // Extract from task.id
                if (task.id && guidPattern.test(task.id)) {
                  keys.add(task.id);
                }
                // Extract from task parameters
                if (task.parameters && Array.isArray(task.parameters)) {
                  for (const param of task.parameters) {
                    if ((param.parameterId === 'text' || param.key === 'text') && param.value) {
                      if (guidPattern.test(param.value)) {
                        keys.add(param.value);
                      }
                    }
                  }
                }
              });
            }
          });
        }
      });
    }

    // Recursively process subData
    if (node.subData && Array.isArray(node.subData)) {
      node.subData.forEach((sub: any) => processNode(sub));
    }
  };

  // Process all main data nodes
  if (Array.isArray(ddt.mainData)) {
    ddt.mainData.forEach((main: any) => processNode(main));
  }

  return keys;
}

interface CompilerOptions {
  getTask: (taskId: string) => any; // Function to resolve Task from taskId
  getDDT?: (taskId: string) => AssembledDDT | null; // Function to get DDT for GetData tasks
  translations?: Record<string, string>; // Translation table: { translationKey: translatedText } - optional, will be collected if not provided
}

/**
 * Compiles flowchart and DDT into flat list of tasks with conditions
 */
export function compileFlow(
  nodes: FlowNode[],
  edges: FlowEdge[],
  options: CompilerOptions
): CompilationResult {
  const tasks: CompiledTask[] = [];
  const taskMap = new Map<string, CompiledTask>();
  const ddtExpansions = new Map<string, DDTExpansion>();

  // ✅ Collect all translation keys from tasks and DDTs
  // This allows runtime to do lookup at execution time instead of "baking" translations during compilation
  const translationKeys = new Set<string>();

  // Find entry nodes (nodes without incoming edges)
  const entryNodes = nodes.filter(n =>
    !edges.some(e => e.target === n.id)
  );

  if (entryNodes.length === 0) {
    return { tasks, entryTaskId: null, taskMap, translations: {} };
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
      // ✅ FIX: Use row.taskId if present, otherwise fallback to row.id
      const taskId = row.taskId || row.id;

      console.log('[Compiler] 🔍 Looking for task', {
        rowId: row.id,
        rowText: row.text,
        rowTaskId: row.taskId,
        lookingForTaskId: taskId,
        usingTaskId: !!row.taskId
      });

      // Resolve task
      const task = options.getTask(taskId);
      if (!task) {
        console.error('[Compiler] ❌ Task not found', {
          taskId,
          nodeId: node.id,
          rowId: row.id,
          rowText: row.text,
          rowTaskId: row.taskId
        });
        throw new Error(`[Compiler] Task not found: ${taskId} in node ${node.id}, row ${row.id}. Task must exist.`);
      }

      console.log('[Compiler] ✅ Task found', {
        taskId: task.id,
        rowId: row.id,
        rowText: row.text,
        taskAction: task.action
      });

      // ✅ Collect translation keys from task
      const taskKeys = extractTranslationKeysFromTask(task);
      taskKeys.forEach(key => translationKeys.add(key));

      // Build condition
      let condition;
      if (rowIndex === 0) {
        // First row: condition based on node topology
        condition = buildFirstRowCondition(node.id, nodes, edges);
      } else {
        // Subsequent rows: previous row completed
        const prevRow = rows[rowIndex - 1];
        // ✅ FIX: Use prevRow.taskId if present, otherwise fallback to prevRow.id
        const prevTaskId = prevRow.taskId || prevRow.id;
        condition = buildSequentialCondition(prevTaskId);
      }

      // Create compiled task
      // Use row.id directly (which equals task.id) - no need to generate new ID
      // ✅ Fields directly on task (no value wrapper) - copy all fields except id, templateId, createdAt, updatedAt
      const { id, templateId, createdAt, updatedAt, ...taskFields } = task;

      const compiledTask: CompiledTask = {
        id: row.id, // row.id === task.id (GUID)
        action: task.action || task.templateId,
        value: taskFields, // ✅ All fields directly (no wrapper)
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
      // ✅ Check if task has DDT (mainData indicates DDT)
      if (task.action === 'GetData' && task.mainData && task.mainData.length > 0 && options.getDDT) {
        const ddt = options.getDDT(task.id);
        if (ddt) {
          // ✅ Collect translation keys from DDT
          const ddtKeys = extractTranslationKeysFromDDT(ddt);
          ddtKeys.forEach(key => translationKeys.add(key));

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

            // ✅ Collect translation keys from expanded DDT tasks
            const expandedTaskKeys = extractTranslationKeysFromTask(ddtTask);
            expandedTaskKeys.forEach(key => translationKeys.add(key));
          }

          ddtExpansions.set(node.id, expansion);
        }
      }

      // If task is ClassifyProblem, expand DDT
      // ✅ Check if task has DDT (mainData indicates DDT)
      if (task.action === 'ClassifyProblem' && task.mainData && task.mainData.length > 0 && options.getDDT) {
        const ddt = options.getDDT(task.id);
        if (ddt) {
          // ✅ Collect translation keys from DDT
          const ddtKeys = extractTranslationKeysFromDDT(ddt);
          ddtKeys.forEach(key => translationKeys.add(key));

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

            // ✅ Collect translation keys from expanded DDT tasks
            const expandedTaskKeys = extractTranslationKeysFromTask(ddtTask);
            expandedTaskKeys.forEach(key => translationKeys.add(key));
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

  // ✅ Build translation table: if translations provided, filter by collected keys; otherwise return empty
  // Runtime will use this table to do lookup at execution time instead of "baking" translations during compilation
  const translations: Record<string, string> = {};
  if (options.translations) {
    const keysArray = Array.from(translationKeys);
    for (const key of keysArray) {
      if (options.translations[key]) {
        translations[key] = options.translations[key];
      }
    }
    console.log('[Compiler] ✅ Translation table built', {
      collectedKeys: translationKeys.size,
      translationsProvided: Object.keys(options.translations).length,
      translationsIncluded: Object.keys(translations).length
    });
  } else {
    console.log('[Compiler] ⚠️ No translations provided - runtime will need to load translations separately', {
      collectedKeys: translationKeys.size
    });
  }

  return {
    tasks,
    entryTaskId,
    taskMap,
    translations // ✅ Translation table for runtime lookup
  };
}

/**
 * Finds entry nodes (nodes without incoming edges)
 * If multiple, returns all (UI should prompt user to choose)
 */
export function findEntryNodes(
  nodes: FlowNode[],
  edges: FlowEdge[]
): FlowNode[] {
  return nodes.filter(n => !edges.some(e => e.target === n.id));
}

