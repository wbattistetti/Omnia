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
  console.log('[DDTAdapter][resolveActionText] 🔍 Starting resolution', {
    hasAction: !!action,
    actionId: action?.actionId,
    actionInstanceId: action?.actionInstanceId,
    hasActionText: !!action?.text,
    actionText: action?.text ? String(action.text).substring(0, 50) : undefined,
    hasDict: !!dict,
    dictKeysCount: dict ? Object.keys(dict).length : 0,
    sampleDictKeys: dict ? Object.keys(dict).slice(0, 5) : [],
    hasParameters: !!action?.parameters,
    parametersCount: action?.parameters ? action.parameters.length : 0
  });

  if (!action) {
    console.warn('[DDTAdapter][resolveActionText] ❌ Action is null/undefined');
    return undefined;
  }

  // Priority: action.text (edited text in DDT instance) > dict[key] (old translation values) > direct value
  // This ensures Chat Simulator uses the same source of truth as StepEditor
  if (action.text && typeof action.text === 'string' && action.text.trim().length > 0) {
    console.log('[DDTAdapter][resolveActionText] ✅ Using action.text directly', {
      text: action.text.substring(0, 50),
      textLength: action.text.length
    });
    return action.text;
  }

  const p = Array.isArray(action.parameters) ? action.parameters.find((x: any) => (x?.parameterId || x?.key) === 'text') : undefined;
  if (!p) {
    console.warn('[DDTAdapter][resolveActionText] ❌ No text parameter found', {
      hasParameters: !!action.parameters,
      parameters: action.parameters
    });
    return undefined;
  }

  const key = p?.value;
  if (!key) {
    console.warn('[DDTAdapter][resolveActionText] ❌ No key found in text parameter', {
      parameter: p
    });
    return undefined;
  }

  console.log('[DDTAdapter][resolveActionText] 🔍 Looking up key in dict', {
    key,
    keyType: typeof key,
    isGuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key),
    keyInDict: key in (dict || {}),
    dictKeysCount: dict ? Object.keys(dict).length : 0,
    allDictKeys: dict ? Object.keys(dict) : [],
    matchingKeys: dict ? Object.keys(dict).filter(k => k === key) : [],
    found: dict ? dict[key] : undefined,
    foundValue: dict && dict[key] ? String(dict[key]).substring(0, 50) : undefined
  });

  // Try as translation key first
  if (dict && dict[key]) {
    console.log('[DDTAdapter][resolveActionText] ✅ Translation found in dict', {
      key,
      value: String(dict[key]).substring(0, 50)
    });
    return dict[key];
  }

  console.warn('[DDTAdapter][resolveActionText] ❌ Translation NOT found in dict', {
    key,
    dictKeysCount: dict ? Object.keys(dict).length : 0,
    keyInDict: dict ? (key in dict) : false,
    allDictKeys: dict ? Object.keys(dict) : []
  });

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

