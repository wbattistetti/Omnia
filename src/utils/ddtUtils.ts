/**
 * Utility functions for DDT (Dialogue Data Template) operations
 */

/**
 * Extracts all GUIDs (translation keys) from a DDT/TaskTree structure.
 * GUIDs are found in:
 * - node.messages[stepKey].textKey
 * - task.id (GUID of the task instance)
 * - task.params.text (translation key)
 *
 * ✅ UPDATED: Supports both old format (ddt.data) and new format (ddt.nodes)
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

  const result = Array.from(guids);

  // ✅ Log only if debug flag is set
  try {
    if (localStorage.getItem('debug.ddtUtils') === '1') {
      console.log('[extractGUIDsFromDDT] ✅ Extracted GUIDs', {
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

