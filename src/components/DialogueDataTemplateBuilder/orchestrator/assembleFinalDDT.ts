import { v4 as uuidv4 } from 'uuid';

/**
 * Step 5: Assembla il DDT finale, patcha spoken key, inserisce scripts, valida
 * @param ddt struttura DDT base
 * @param messages oggetto messages (spokenKey -> testo)
 * @returns DDT finale pronto per la UI o il salvataggio
 */
export default function assembleFinalDDT(ddt: any, messages: Record<string, string>): any {
  const usedKeys = new Set<string>();
  const keyMap: Record<string, string> = {};
  const newMessages: Record<string, string> = {};

  function patchNode(node: any, path: string) {
    // Patch label, description, payoff, message, ecc.
    ['label', 'description', 'payoff', 'message'].forEach(key => {
      if (node[key] !== undefined) {
        const baseKey = `${path}.${key}`;
        let spokenKey = keyMap[baseKey];
        if (!spokenKey) {
          spokenKey = `${baseKey}_${uuidv4()}`;
          keyMap[baseKey] = spokenKey;
        }
        node[key] = spokenKey;
        if (messages && messages[baseKey]) {
          newMessages[spokenKey] = messages[baseKey];
        }
      }
    });
    // Patch constraints
    if (Array.isArray(node.constraints)) {
      node.constraints.forEach((c: any, i: number) => {
        patchNode(c, `${path}.constraints.${i}`);
      });
    }
    // Patch subData
    if (Array.isArray(node.subData)) {
      node.subData.forEach((sub: any, i: number) => {
        patchNode(sub, `${path}.subData.${i}`);
      });
    }
    // Patch steps/escalation/parameters
    if (Array.isArray(node.steps)) {
      node.steps.forEach((step: any, si: number) => {
        if (Array.isArray(step.escalation)) {
          step.escalation.forEach((esc: any, ei: number) => {
            if (Array.isArray(esc.parameters)) {
              esc.parameters.forEach((param: any, pi: number) => {
                const baseKey = `${path}.steps.${si}.escalation.${ei}.parameters.${pi}.value`;
                let spokenKey = keyMap[baseKey];
                if (!spokenKey) {
                  spokenKey = `${baseKey}_${uuidv4()}`;
                  keyMap[baseKey] = spokenKey;
                }
                param.value = spokenKey;
                if (messages && messages[baseKey]) {
                  newMessages[spokenKey] = messages[baseKey];
                }
              });
            }
          });
        }
      });
    }
  }

  patchNode(ddt, 'ddt');

  // Validazione: spoken key uniche
  Object.values(keyMap).forEach(k => {
    if (usedKeys.has(k)) throw new Error(`Spoken key duplicata: ${k}`);
    usedKeys.add(k);
  });

  // TODO: validazione loop ricorsivi, altri controlli

  return { ddt, messages: newMessages };
} 