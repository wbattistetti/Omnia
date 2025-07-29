import { v4 as uuidv4 } from 'uuid';

// --- TYPES ---
type Constraint = {
  id: string;
  label: string;
  payoff: string;
  prompts: string[];
  validationScript: string;
  testSet: { input: any; expected: any }[];
};

type ActionParameter = {
  parameterId: string;
  value: string; // key in translations
};

type Action = {
  actionId: string;
  actionInstanceId: string;
  parameters: ActionParameter[];
};

type Escalation = {
  escalationId: string;
  actions: Action[];
};

type StepGroup = {
  type: "start" | "noMatch" | "noInput" | "confirmation" | "success";
  escalations: Escalation[];
};

type MainData = {
  variable: string;
  label?: string;
  description?: string;
  payoff?: string;
  constraints: Constraint[];
  steps: StepGroup[];
  subData: MainData[];
  meta?: {
    parentId?: string;
    path?: string;
    order?: number;
  };
};

type DDT = {
  id: string;
  mainData: MainData;
  translations: Record<string, string>;
};

const KNOWN_ACTIONS = {
  askQuestion: { defaultParameter: 'text' },
  sayMessage: { defaultParameter: 'text' }
  // ... altri tipi se servono
};

// --- UTILITY: arricchisci constraints ---
function enrichConstraint(type: string): Partial<Constraint> {
  if (type === "pastDate") {
    return {
      label: "Must be in the past",
      payoff: "Prevents future dates.",
      validationScript: "return new Date(value) < new Date();",
      testSet: [
        { input: "2022-01-01", expected: true },
        { input: "2100-01-01", expected: false }
      ]
    };
  }
  // Altri tipi...
  return {};
}

function normalizeConstraints(constraints: any[]): Constraint[] {
  return constraints.map(c => ({
    ...enrichConstraint(c.type),
    ...c,
    id: c.id || uuidv4(),
    prompts: c.prompts || [],
    testSet: c.testSet || [],
    validationScript: c.validationScript || "",
    payoff: c.payoff || "",
    label: c.label || c.type,
  }));
}

// --- UTILITY: prompts dei constraint in translations ---
function addConstraintPromptsToTranslations(
  ddtId: string,
  constraint: Constraint,
  translations: Record<string, string>
): Constraint {
  const newPrompts: string[] = constraint.prompts.map((msg, idx) => {
    const key = `runtime.${ddtId}.constraint#${constraint.id}.prompt#${idx+1}`;
    translations[key] = msg;
    return key;
  });
  return { ...constraint, prompts: newPrompts };
}

// --- CORE: ricorsiva mainData/subData ---
function assembleMainData(
  ddtId: string,
  dataNode: any, // struttura ricorsiva con subData, constraints, steps, messages
  translations: Record<string, string>,
  stepMessages: Record<string, string[][]> // es: { start: [[msg1, msg2]], noMatch: [[msg3]], ... }
): MainData {
  // Constraints arricchiti
  let constraints: Constraint[] = normalizeConstraints(dataNode.constraints || []);
  constraints = constraints.map(c => addConstraintPromptsToTranslations(ddtId, c, translations));

  // Steps
  const steps: StepGroup[] = Object.entries(stepMessages).map(([stepType, escalationsArr]) => ({
    type: stepType as StepGroup["type"],
    escalations: (escalationsArr as string[][]).map((messages, escIdx) => {
      const escalationId = uuidv4();
      // Ogni escalation può avere più azioni (qui semplificato: una per messaggio)
      const actions: Action[] = messages.map((msg, msgIdx) => {
        // TODO: decidi actionId in base al tipo di step o messaggio
        const actionId = stepType === "start" ? "askQuestion" : "sayMessage";
        const actionInstanceId = `${actionId}_${escIdx + 1}_${msgIdx + 1}_${uuidv4().slice(0, 8)}`;
        const parameterId = KNOWN_ACTIONS[actionId].defaultParameter;
        const valueKey = `runtime.${ddtId}.${stepType}#${escIdx + 1}.${actionInstanceId}.${parameterId}.text`;
        translations[valueKey] = msg;
        return {
          actionId,
          actionInstanceId,
          parameters: [{ parameterId, value: valueKey }]
        };
      });
      return { escalationId, actions };
    })
  }));

  // Ricorsivo per subData
  const subData: MainData[] = (dataNode.subData || []).map((sub: any) =>
    assembleMainData(ddtId, sub, translations, sub.stepMessages || {})
  );

  // Metadata opzionale
  const meta = dataNode.meta || undefined;

  // Label logica: label > name > type
  const label = dataNode.label || dataNode.name || dataNode.type;

  return {
    variable: dataNode.variable || dataNode.name,
    label,
    description: dataNode.description,
    payoff: dataNode.payoff,
    constraints,
    steps,
    subData,
    meta
  };
}

// --- ENTRYPOINT ---
export function assembleFinalDDT(
  ddtId: string,
  mainData: any, // struttura ricorsiva
  stepMessages: Record<string, string[][]>, // es: { start: [[msg1]], noMatch: [[msg2]], ... }
  translations: Record<string, string> = {},
  stepResults?: any[]
): DDT {
  // Trova la label suggerita dall'AI (detectType)
  let aiLabel = '';
  if (stepResults && Array.isArray(stepResults)) {
    for (const result of stepResults) {
      if (result.stepKey === 'detectType' && result.payload && result.payload.label) {
        aiLabel = result.payload.label;
        break;
      }
      // fallback: usa type se label non c'è
      if (result.stepKey === 'detectType' && result.payload && result.payload.type && !aiLabel) {
        aiLabel = result.payload.type;
      }
    }
  }
  console.log('[assembleFinalDDT] aiLabel:', aiLabel, 'mainData.label:', mainData.label);
  if (!aiLabel) {
    console.warn('[assembleFinalDDT] ATTENZIONE: aiLabel non trovato, verrà usata mainData.label o fallback!');
  }
  // Forza sempre la presenza di id e label
  const id = ddtId || 'ddt_' + Math.random().toString(36).slice(2);
  const label = aiLabel || mainData.label || mainData.name || mainData.type || 'New DDT';
  console.log('[assembleFinalDDT] LABEL FINALE:', label);
  // Patch: sovrascrivi SEMPRE mainData.label con la label scelta
  const ddt = {
    id,
    label,
    mainData: { ...mainData, label },
    translations
  };
  console.log('[assembleFinalDDT] DDT finale (patch):', ddt);
  return ddt;
} 