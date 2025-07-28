import { StepResult } from './types';
import { v4 as uuidv4 } from 'uuid';

// Tipo base per output DDT
export interface DDTNode {
  id: string;
  name: string;
  type?: string;
  prompts?: Record<string, string>;
  validationRules?: any[];
  constraints?: any[];
  steps?: any[];
  subdata?: DDTNode[];
}

// Utility per generare la runtimeKey
function makeRuntimeKey(ddtId: string, step: string, escalationIdx: number, actionInstanceId: string) {
  return `runtime.${ddtId}.${step}#${escalationIdx}.${actionInstanceId}.text`;
}

// Funzione di assemblaggio finale
export function assembleFinalDDT(stepResults: StepResult[]): { structure: DDTNode, translations: Record<string, string> } {
  console.log('[assembleFinalDDT] stepResults:', stepResults);
  stepResults.forEach((result, idx) => {
    console.log(`[assembleFinalDDT] stepResult[${idx}]:`, result.stepKey, result.payload);
    if (result.stepKey === 'suggestStructureAndConstraints') {
      console.log(`[assembleFinalDDT] suggestStructureAndConstraints payload:`, result.payload);
    }
  });
  // Esempio: estrai nome e prompts dai risultati
  const ddtId = 'ddt_' + Math.random().toString(36).slice(2);
  const ddt: DDTNode = {
    id: ddtId,
    name: 'TODO', // verrà sovrascritto se troviamo il tipo
    prompts: {},
    validationRules: [],
    constraints: [],
    steps: [],
    subdata: [],
  };
  const translations: Record<string, string> = {};

  // Esempio di mapping reale (da adattare ai tuoi stepResults)
  for (const result of stepResults) {
    // Se troviamo lo step detectType, usiamo il tipo suggerito come name
    if (result.stepKey === 'detectType' && result.payload && result.payload.type) {
      console.log('[assembleFinalDDT] detectType trovato, imposto name:', result.payload.type);
      ddt.name = result.payload.type;
    }
    // Prompts (es: startPrompt, noMatchPrompts, ecc.)
    if (result.stepKey.endsWith('Prompts') && typeof result.payload === 'object' && result.payload !== null) {
      // Supponiamo che result.payload sia: { messages: ["msg1", "msg2", ...] }
      const step = result.stepKey.replace('Prompts', ''); // es: start, noMatch
      const messages = Array.isArray(result.payload) ? result.payload : result.payload.messages || result.payload;
      if (Array.isArray(messages)) {
        messages.forEach((msg: string, idx: number) => {
          const actionInstanceId = `${step}Msg${idx+1}_${uuidv4()}`;
          const runtimeKey = makeRuntimeKey(ddtId, step, idx+1, actionInstanceId);
          translations[runtimeKey] = msg;
          // Puoi anche popolare ddt.prompts o steps qui se serve
          if (!ddt.prompts) ddt.prompts = {};
          ddt.prompts[runtimeKey] = msg;
        });
      }
    }
    // TODO: mapping per validationRules, constraints, subdata, ecc.
    if (result.stepKey === 'suggestStructureAndConstraints' && result.payload) {
      ddt.constraints = result.payload.mainData?.constraints || [];
      // Log dettagliato per subData
      console.log('[assembleFinalDDT] subData trovata (root):', result.payload.subData);
      console.log('[assembleFinalDDT] subData trovata (mainData):', result.payload.mainData?.subData);
      // Prova entrambi i path
      const subDataArr = result.payload.subData || result.payload.mainData?.subData || [];
      ddt.subdata = subDataArr.map((sub: any) => ({
        id: uuidv4(),
        name: sub.name,
        constraints: sub.constraints || [],
      }));
    }
    // Altri step: validationRules, scripts, ecc.
    if (result.stepKey === 'validationRules' && result.payload) {
      ddt.validationRules = result.payload;
    }
  }
  console.log('[assembleFinalDDT] DDT finale:', ddt);
  console.log('[assembleFinalDDT] DDT finale (JSON):\n' + JSON.stringify(ddt, null, 2));
  return { structure: ddt, translations };
} 