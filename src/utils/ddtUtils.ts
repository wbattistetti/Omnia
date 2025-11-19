/**
 * Utility functions for DDT (Dialogue Data Template) operations
 */

/**
 * Extracts all GUIDs (translation keys) from a DDT structure.
 * GUIDs are found in:
 * - node.messages[stepKey].textKey
 * - action.actionInstanceId
 * - action.parameters (where parameterId === 'text').value
 *
 * @param ddt - The DDT object to extract GUIDs from
 * @returns Array of unique GUID strings found in the DDT
 */
export function extractGUIDsFromDDT(ddt: any): string[] {
  const guids = new Set<string>();

  if (!ddt?.mainData) {
    return [];
  }

  const processNode = (node: any) => {
    // Extract from messages
    if (node.messages) {
      Object.entries(node.messages).forEach(([stepKey, msg]: [string, any]) => {
        if (msg?.textKey && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(msg.textKey)) {
          guids.add(msg.textKey);
        }
      });
    }

    // Extract from escalations
    if (node.steps) {
      Object.entries(node.steps).forEach(([stepKey, step]: [string, any]) => {
        if (step.escalations) {
          step.escalations.forEach((esc: any) => {
            if (esc.actions) {
              esc.actions.forEach((action: any) => {
                const actionInstanceId = action.actionInstanceId;
                if (actionInstanceId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actionInstanceId)) {
                  guids.add(actionInstanceId);
                }
                const textParam = action.parameters?.find((p: any) => p.parameterId === 'text');
                if (textParam?.value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(textParam.value)) {
                  guids.add(textParam.value);
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

  ddt.mainData.forEach((main: any) => processNode(main));
  return Array.from(guids);
}

