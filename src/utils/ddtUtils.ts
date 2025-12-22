/**
 * Utility functions for DDT (Dialogue Data Template) operations
 */

/**
 * Extracts all GUIDs (translation keys) from a DDT structure.
 * GUIDs are found in:
 * - node.messages[stepKey].textKey
 * - task.taskId (GUID of the task instance)
 * - task.parameters (where parameterId === 'text').value
 *
 * @param ddt - The DDT object to extract GUIDs from
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

  if (!ddt?.mainData) {
    console.log('[extractGUIDsFromDDT] ❌ No mainData in DDT', { ddt: ddt ? Object.keys(ddt) : null });
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
                hasActions: !!esc.actions,
                actionsCount: esc.actions?.length || 0
              });
            }
            taskRefs.forEach((task: any, taskIdx: number) => {
              debugInfo.tasksProcessed++;
              // ✅ taskId is the GUID of the task instance
              const taskId = task.taskId;
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

    // Recursively process subData
    if (node.subData && Array.isArray(node.subData)) {
      node.subData.forEach((sub: any) => processNode(sub, currentNodePath));
    }
  };

  ddt.mainData.forEach((main: any) => processNode(main));

  const result = Array.from(guids);
  console.log('[extractGUIDsFromDDT] ✅ Extracted GUIDs', {
    totalGuids: result.length,
    fromMessages: debugInfo.fromMessages.length,
    fromTaskIds: debugInfo.fromTaskIds.length,
    fromTextParams: debugInfo.fromTextParams.length,
    nodesProcessed: debugInfo.nodesProcessed,
    escalationsProcessed: debugInfo.escalationsProcessed,
    tasksProcessed: debugInfo.tasksProcessed,
    sampleGuids: result.slice(0, 10),
    sampleFromTaskIds: debugInfo.fromTaskIds.slice(0, 5),
    sampleFromTextParams: debugInfo.fromTextParams.slice(0, 5)
  });

  return result;
}

