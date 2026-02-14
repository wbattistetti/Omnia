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
  return esc?.tasks || [];
}

export function resolveActionText(action: any, dict: Record<string, string>): string | undefined {
  if (!action) {
    return undefined;
  }

  // Priority: action.text (edited text in DDT instance) > dict[key] (translation) > direct value
  if (action.text && typeof action.text === 'string' && action.text.trim().length > 0) {
    console.log('[Translation] ✅ Using direct text:', action.text.substring(0, 100) + (action.text.length > 100 ? '...' : ''));
    return action.text;
  }

  const p = Array.isArray(action.parameters) ? action.parameters.find((x: any) => (x?.parameterId || x?.key) === 'text') : undefined;
  if (!p) {
    return undefined;
  }

  const key = p?.value;
  if (!key) {
    return undefined;
  }

  // ✅ LOG: Chiave trovata
  console.log('[Translation] 🔑 Key found:', key);

  // Try as translation key first
  if (dict && dict[key]) {
    // ✅ LOG: Traduzione trovata
    console.log('[Translation] ✅ Translation found:', {
      key,
      text: String(dict[key]).substring(0, 100) + (String(dict[key]).length > 100 ? '...' : '')
    });
    return dict[key];
  }

  // ✅ LOG: Traduzione NON trovata (solo warning, non verbose)
  console.warn('[Translation] ❌ NOT FOUND:', key);

  // If not found in dict, try as direct text value
  // A key is usually a short identifier like "start.1" or "ask.base"
  // Direct text is usually longer, contains spaces, or looks like a sentence
  if (typeof key === 'string') {
    const trimmed = key.trim();
    // If it looks like a sentence (has spaces or is longer than typical keys), use it directly
    if (trimmed.length > 0 && (trimmed.includes(' ') || trimmed.length > 30 || !trimmed.match(/^[a-zA-Z0-9_.-]+$/))) {
      return trimmed;
    }
  }

  return undefined;
}

