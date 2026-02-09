/**
 * Utility functions for DDT (Dialogue Data Template) operations
 */

/**
 * Extracts all GUIDs (translation keys) from a DDT/TaskTree structure.
 * GUIDs are found in:
 * - node.messages[stepKey].textKey
 * - task.id (GUID of the task instance)
 * - task.params.text (translation key)
 * - ddt.steps[templateId][stepKey].escalations[].tasks[] (for multi-data tasks)
 *
 * ✅ UPDATED: Supports both old format (ddt.data) and new format (ddt.nodes)
 * ✅ UPDATED: Also processes ddt.steps dictionary for multi-data tasks (sub-data nodes)
 *
 * @param ddt - The DDT/TaskTree object to extract GUIDs from
 * @returns Array of unique GUID strings found in the DDT
 */
export function extractGUIDsFromDDT(ddt: any): string[] {
  const guids = new Set<string>();
  const debugInfo: any = {
    fromMessages: [] as string[],
    fromTaskIds: [] as string[],
    fromTextParams: [] as string[],
    nodesProcessed: 0,
    escalationsProcessed: 0,
    tasksProcessed: 0
  };

  // ✅ Support both old format (data) and new format (nodes)
  const nodesArray = ddt?.nodes || ddt?.data;
  if (!nodesArray || !Array.isArray(nodesArray) || nodesArray.length === 0) {
    if (ddt) {
      console.log('[extractGUIDsFromDDT] ❌ No nodes/data in DDT', {
        ddt: Object.keys(ddt),
        hasNodes: !!ddt.nodes,
        hasData: !!ddt.data,
        nodesType: typeof ddt.nodes,
        dataType: typeof ddt.data
      });
    }
    return [];
  }

  const processNode = (node: any, nodePath: string = '') => {
    debugInfo.nodesProcessed++;
    const currentNodePath = nodePath ? `${nodePath}.${node.label || 'unnamed'}` : (node.label || 'root');

    // Extract from messages
    if (node.messages) {
      Object.entries(node.messages).forEach(([stepKey, msg]: [string, any]) => {
        if (msg?.textKey && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(msg.textKey)) {
          guids.add(msg.textKey);
          debugInfo.fromMessages.push({ nodePath: currentNodePath, stepKey, guid: msg.textKey });
        }
      });
    }

    // Extract from escalations
    if (node.steps) {
      Object.entries(node.steps).forEach(([stepKey, step]: [string, any]) => {
        if (step.escalations) {
          debugInfo.escalationsProcessed += step.escalations.length;
          step.escalations.forEach((esc: any, escIdx: number) => {
            // ✅ Extract from tasks array
            const taskRefs = esc.tasks || [];
            if (taskRefs.length === 0) {
              console.log(`[extractGUIDsFromDDT] ⚠️ No tasks in escalation`, {
                nodePath: currentNodePath,
                stepKey,
                escIdx,
                hasTasks: !!esc.tasks,
                tasksCount: esc.tasks?.length || 0
              });
            }
            taskRefs.forEach((task: any, taskIdx: number) => {
              debugInfo.tasksProcessed++;
              // ✅ id is the GUID of the task instance
              const taskId = task.id;
              if (taskId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId)) {
                guids.add(taskId);
                debugInfo.fromTaskIds.push({ nodePath: currentNodePath, stepKey, escIdx, taskIdx, guid: taskId, templateId: task.templateId });
              } else if (taskId) {
                console.log(`[extractGUIDsFromDDT] ⚠️ Invalid taskId format`, {
                  nodePath: currentNodePath,
                  stepKey,
                  escIdx,
                  taskIdx,
                  taskId,
                  taskIdLength: taskId.length,
                  isGuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId)
                });
              }
              // Extract from text parameter
              const textParam = task.parameters?.find((p: any) => p.parameterId === 'text');
              if (textParam?.value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textParam.value)) {
                guids.add(textParam.value);
                debugInfo.fromTextParams.push({ nodePath: currentNodePath, stepKey, escIdx, taskIdx, guid: textParam.value });
              } else if (textParam?.value) {
                console.log(`[extractGUIDsFromDDT] ⚠️ Invalid textParam.value format`, {
                  nodePath: currentNodePath,
                  stepKey,
                  escIdx,
                  taskIdx,
                  textParamValue: textParam.value,
                  textParamValueLength: textParam.value?.length,
                  isGuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textParam.value)
                });
              }
            });
          });
        }
      });
    }

    // ✅ Recursively process subNodes (new format) or subTasks (old format)
    const subNodes = node.subNodes || node.subTasks;
    if (subNodes && Array.isArray(subNodes)) {
      subNodes.forEach((sub: any) => processNode(sub, currentNodePath));
    }
  };

  nodesArray.forEach((main: any) => processNode(main));

  // ✅ CRITICAL FIX: Also process ddt.steps dictionary (for multi-data tasks)
  // taskTree.steps format: { "templateId": { "start": {...}, "noMatch": {...}, ... } }
  // This is needed because for multi-data tasks, sub-data nodes' steps are stored in taskTree.steps[subDataTemplateId]
  // and not inside node.steps within the nodes array
  if (ddt?.steps && typeof ddt.steps === 'object' && !Array.isArray(ddt.steps)) {
    console.log('[extractGUIDsFromDDT] 🔍 Processing ddt.steps dictionary', {
      stepsKeys: Object.keys(ddt.steps),
      stepsCount: Object.keys(ddt.steps).length
    });

    Object.entries(ddt.steps).forEach(([templateId, nodeSteps]: [string, any]) => {
      if (nodeSteps && typeof nodeSteps === 'object') {
        console.log(`[extractGUIDsFromDDT] 🔍 Processing templateId: ${templateId}`, {
          stepKeys: Object.keys(nodeSteps),
          stepKeysCount: Object.keys(nodeSteps).length
        });

        // Process each step type (start, noMatch, etc.)
        Object.entries(nodeSteps).forEach(([stepKey, step]: [string, any]) => {
          if (step?.escalations && Array.isArray(step.escalations)) {
            step.escalations.forEach((esc: any, escIdx: number) => {
              if (esc?.tasks && Array.isArray(esc.tasks)) {
                console.log(`[extractGUIDsFromDDT] 🔍 Found ${esc.tasks.length} tasks in ${templateId}.${stepKey}.escalations[${escIdx}]`);

                esc.tasks.forEach((task: any, taskIdx: number) => {
                  debugInfo.tasksProcessed++;
                  // Extract task.id (GUID)
                  if (task.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(task.id)) {
                    guids.add(task.id);
                    debugInfo.fromTaskIds.push({ nodePath: `steps[${templateId}]`, stepKey, escIdx, taskIdx, guid: task.id, templateId });
                    console.log(`[extractGUIDsFromDDT] ✅ Extracted task.id GUID: ${task.id} from steps[${templateId}].${stepKey}`);
                  }
                  // Extract text parameter GUID
                  const textParam = task.parameters?.find((p: any) => p.parameterId === 'text');
                  if (textParam?.value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textParam.value)) {
                    guids.add(textParam.value);
                    debugInfo.fromTextParams.push({ nodePath: `steps[${templateId}]`, stepKey, escIdx, taskIdx, guid: textParam.value });
                    console.log(`[extractGUIDsFromDDT] ✅ Extracted textParam.value GUID: ${textParam.value} from steps[${templateId}].${stepKey}`);
                  } else if (textParam?.value) {
                    console.log(`[extractGUIDsFromDDT] ⚠️ Invalid textParam.value format in steps[${templateId}].${stepKey}`, {
                      value: textParam.value,
                      isGuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textParam.value)
                    });
                  }
                });
              }
            });
          }
        });
      }
    });
  } else {
    console.log('[extractGUIDsFromDDT] ⚠️ No ddt.steps dictionary found', {
      hasSteps: !!ddt?.steps,
      stepsType: typeof ddt?.steps,
      isArray: Array.isArray(ddt?.steps)
    });
  }

  const result = Array.from(guids);

  console.log('[extractGUIDsFromDDT] 📊 Final GUIDs extracted', {
    totalGuids: result.length,
    fromMessages: debugInfo.fromMessages.length,
    fromTaskIds: debugInfo.fromTaskIds.length,
    fromTextParams: debugInfo.fromTextParams.length,
    fromNodes: debugInfo.fromTaskIds.length + debugInfo.fromTextParams.length,
    fromSteps: result.length - (debugInfo.fromTaskIds.length + debugInfo.fromTextParams.length),
    sampleGuids: result.slice(0, 10)
  });

  // ✅ Log only if debug flag is set
  try {
    if (localStorage.getItem('debug.ddtUtils') === '1') {
      console.log('[extractGUIDsFromDDT] ✅ Detailed debug info', {
        totalGuids: result.length,
        fromMessages: debugInfo.fromMessages.length,
        fromTaskIds: debugInfo.fromTaskIds.length,
        fromTextParams: debugInfo.fromTextParams.length,
        sampleGuids: result.slice(0, 5)
      });
    }
  } catch {}

  return result;
}

