import type { AssembledDDT } from '../../../../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';

/**
 * Finds and updates action.text in the DDT structure for a given textKey and stepType.
 * This ensures that when editing messages in Chat Simulator, we update the same source
 * of truth (action.text) that StepEditor uses.
 */
export function updateActionTextInDDT(
  ddt: AssembledDDT,
  textKey: string,
  stepType: string,
  newText: string,
  escalationNumber?: number
): AssembledDDT {
  if (!ddt || !textKey) return ddt;

  // Map stepType to stepKey (Chat Simulator uses different names than DDT structure)
  const stepTypeMap: Record<string, string> = {
    'ask': 'start',
    'start': 'start',
    'noMatch': 'noMatch',
    'noInput': 'noInput',
    'confirmation': 'confirmation',
    'confirm': 'confirmation',
    'success': 'success',
    'introduction': 'introduction'
  };
  const stepKey = stepTypeMap[stepType] || stepType;

  // Helper to update action in a node
  // IMPORTANT: This function mutates the node, so it should be called on a cloned copy
  const updateActionInNode = (node: any): boolean => {
    if (!node?.steps) return false;

    // Case A: steps as object { start: { escalations: [...] } }
    if (!Array.isArray(node.steps) && node.steps[stepKey]) {
      const stepData = node.steps[stepKey];
      if (stepData?.escalations && Array.isArray(stepData.escalations)) {
        const escIndex = escalationNumber ? escalationNumber - 1 : 0; // escalationNumber is 1-indexed
        const esc = stepData.escalations[escIndex];
        if (esc?.actions && Array.isArray(esc.actions)) {
          for (let i = 0; i < esc.actions.length; i++) {
            const action = esc.actions[i];
            const p = Array.isArray(action?.parameters)
              ? action.parameters.find((x: any) => (x?.parameterId || x?.key) === 'text')
              : undefined;
            const actionTextKey = p?.value;
            if (actionTextKey === textKey) {
              // Mutate the node (should be a clone)
              esc.actions[i] = {
                ...action,
                text: newText.length > 0 ? newText : undefined
              };
              return true;
            }
          }
        }
      }
    }

    // Case B: steps as array [{ type: 'start', escalations: [...] }, ...]
    if (Array.isArray(node.steps)) {
      const group = node.steps.find((g: any) => g?.type === stepKey);
      if (group?.escalations && Array.isArray(group.escalations)) {
        const escIndex = escalationNumber ? escalationNumber - 1 : 0;
        const esc = group.escalations[escIndex];
        if (esc?.actions && Array.isArray(esc.actions)) {
          for (let i = 0; i < esc.actions.length; i++) {
            const action = esc.actions[i];
            const p = Array.isArray(action?.parameters)
              ? action.parameters.find((x: any) => (x?.parameterId || x?.key) === 'text')
              : undefined;
            const actionTextKey = p?.value;
            if (actionTextKey === textKey) {
              // Mutate the node (should be a clone)
              esc.actions[i] = {
                ...action,
                text: newText.length > 0 ? newText : undefined
              };
              return true;
            }
          }
        }
      }
    }

    return false;
  };

  // ✅ NUOVO MODELLO: Usa nodes[] e subNodes[] invece di data[] e subData[]
  // Create a deep clone to ensure React detects the change
  const mains = Array.isArray((ddt as any)?.nodes)
    ? (ddt as any).nodes.map((m: any) => JSON.parse(JSON.stringify(m)))
    : [];

  let updated = false;
  for (let i = 0; i < mains.length; i++) {
    const main = mains[i];
    if (!main) continue;
    // Try main node
    if (updateActionInNode(main)) {
      updated = true;
      break;
    }
    // Try sub nodes
    if (Array.isArray(main.subNodes)) {
      for (let j = 0; j < main.subNodes.length; j++) {
        const sub = main.subNodes[j];
        if (updateActionInNode(sub)) {
          updated = true;
          break;
        }
      }
      if (updated) break;
    }
  }

  if (updated) {
    return {
      ...ddt,
      nodes: mains
    };
  }

  // Try introduction step at root level
  if ((ddt as any)?.introduction) {
    // Create a deep clone of introduction
    const intro = JSON.parse(JSON.stringify((ddt as any).introduction));
    if (intro?.escalations && Array.isArray(intro.escalations)) {
      const esc = intro.escalations[0];
      if (esc?.actions && Array.isArray(esc.actions)) {
        for (let i = 0; i < esc.actions.length; i++) {
          const action = esc.actions[i];
          const p = Array.isArray(action?.parameters)
            ? action.parameters.find((x: any) => (x?.parameterId || x?.key) === 'text')
            : undefined;
          const actionTextKey = p?.value;
          if (actionTextKey === textKey) {
            const updatedIntro = {
              ...intro,
              escalations: [
                {
                  ...esc,
                  actions: [
                    ...esc.actions.slice(0, i),
                    {
                      ...action,
                      text: newText.length > 0 ? newText : undefined
                    },
                    ...esc.actions.slice(i + 1)
                  ]
                },
                ...intro.escalations.slice(1)
              ]
            };
            return { ...ddt, introduction: updatedIntro };
          }
        }
      }
    }
  }

  return ddt;
}

