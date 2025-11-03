export type Escalation = { actions: any[] };
export type StepGroup = { type: string; escalations: Escalation[] };

export function extractTranslations(ddt: any, translations?: any): Record<string, string> {
  const fromDDT: Record<string, string> = (ddt?.translations?.en || ddt?.translations || {}) as Record<string, string>;
  return { ...(translations || {}), ...fromDDT };
}

export function getStepsArray(node: any): StepGroup[] {
  if (!node) return [];
  if (Array.isArray(node.steps)) {
    return node.steps.map((s: any) => ({ type: s.type || s.stepType, escalations: s.escalations || [] }));
  }
  if (node.steps && typeof node.steps === 'object') {
    const map = node.steps as Record<string, any>;
    return Object.keys(map).map((k) => {
      const v = map[k];
      if (Array.isArray(v?.escalations)) return { type: k, escalations: v.escalations };
      if (Array.isArray(v)) {
        return { type: k, escalations: [ { actions: v } ] };
      }
      return { type: k, escalations: [] };
    });
  }
  return [];
}

export function getStepGroup(node: any, stepType: string): StepGroup | undefined {
  const steps = getStepsArray(node);
  return steps.find((s) => s.type === stepType);
}

export function getEscalationActions(node: any, stepType: string, level: number): any[] {
  const sg = getStepGroup(node, stepType);
  const esc = sg?.escalations?.[level - 1];
  return esc?.actions || [];
}

export function resolveActionText(action: any, dict: Record<string, string>): string | undefined {
  if (!action) return undefined;
  // Priority: action.text (edited text in DDT instance) > dict[key] (old translation values)
  // This ensures Chat Simulator uses the same source of truth as StepEditor
  if (action.text && typeof action.text === 'string' && action.text.trim().length > 0) {
    return action.text;
  }
  const p = Array.isArray(action.parameters) ? action.parameters.find((x: any) => (x?.parameterId || x?.key) === 'text') : undefined;
  const key = p?.value;
  if (key && dict[key]) return dict[key];
  return undefined;
}

