export type Escalation = { actions: any[] };
export type StepGroup = { type: string; escalations: Escalation[] };

export function extractTranslations(ddt: any, translations?: any): Record<string, string> {
  // ✅ Translations now come ONLY from global table (passed as flat dictionary)
  // ❌ REMOVED: Fallback to ddt.translations - DDT no longer contains translations

  if (translations && typeof translations === 'object') {
    // Check if it's a flat dictionary (not multilingual structure like { en: {...}, it: {...} })
    const isFlat = !translations.en && !translations.it && !translations.pt;
    if (isFlat) {
      // It's already filtered by locale, use it directly
      console.log('[DDTAdapter][extractTranslations] ✅ Using flat translations dictionary from global table', {
        keysCount: Object.keys(translations).length,
        sampleKeys: Object.keys(translations).slice(0, 5),
        sampleValues: Object.entries(translations).slice(0, 3).map(([k, v]) => ({ key: k, value: String(v).substring(0, 30) }))
      });
      return translations as Record<string, string>;
    }

    // If multilingual structure, extract for project locale
    const projectLang = (() => {
      try {
        return localStorage.getItem('project.lang') || 'en';
      } catch {
        return 'en';
      }
    })();

    const localeTranslations = translations[projectLang] || translations.en || {};
    console.log('[DDTAdapter][extractTranslations] ✅ Using multilingual translations for locale', {
      projectLang,
      keysCount: Object.keys(localeTranslations).length,
      sampleKeys: Object.keys(localeTranslations).slice(0, 5)
    });
    return localeTranslations as Record<string, string>;
  }

  // No translations provided - return empty (translations should always come from global table)
  console.warn('[DDTAdapter][extractTranslations] ⚠️ No translations provided - translations should come from global table');
  return {};
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
  if (!action) {
    console.warn('[DEBUG][RESOLVE_ACTION] ❌ Action is null/undefined');
    return undefined;
  }

  // Priority: action.text (edited text in DDT instance) > dict[key] (old translation values)
  if (action.text && typeof action.text === 'string' && action.text.trim().length > 0) {
    console.log('[DEBUG][RESOLVE_ACTION] ✅ Using action.text directly', {
      text: action.text.substring(0, 50),
      textLength: action.text.length
    });
    return action.text;
  }

  console.log('[DEBUG][RESOLVE_ACTION] 🔍 Resolving from dict', {
    actionId: action.actionId,
    actionInstanceId: action.actionInstanceId,
    hasParameters: !!action.parameters,
    parametersCount: action.parameters?.length || 0,
    parameters: action.parameters?.map((p: any) => ({
      parameterId: p.parameterId,
      key: p.key,
      value: p.value,
      valueType: typeof p.value,
      isGuid: p.value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.value)
    })) || [],
    dictKeysCount: Object.keys(dict).length,
    sampleDictKeys: Object.keys(dict).slice(0, 10)
  });

  const p = Array.isArray(action.parameters) ? action.parameters.find((x: any) => (x?.parameterId || x?.key) === 'text') : undefined;
  const key = p?.value;

  console.log('[DEBUG][RESOLVE_ACTION] 🔍 Text parameter found', {
    hasParam: !!p,
    param: p ? {
      parameterId: p.parameterId,
      key: p.key,
      value: p.value
    } : null,
    key,
    keyType: typeof key,
    isGuid: key && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)
  });

  if (key) {
    const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
    const found = dict[key];

    console.log('[DEBUG][RESOLVE_ACTION] 🔍 Looking up in dict', {
      key,
      isGuid,
      keyInDict: key in dict,
      found: found ? found.substring(0, 50) : undefined,
      dictKeysCount: Object.keys(dict).length,
      allGuidsInDict: Object.keys(dict).filter(k => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)),
      sampleDictKeys: Object.keys(dict).slice(0, 10),
      keyMatches: Object.keys(dict).filter(k => k === key)
    });

    if (found) {
      console.log('[DEBUG][RESOLVE_ACTION] ✅ Translation found', {
        key,
        value: found.substring(0, 50),
        isGuid
      });
      return found;
    } else {
      console.warn('[DEBUG][RESOLVE_ACTION] ❌ Translation NOT found', {
        key,
        isGuid,
        actionInstanceId: action.actionInstanceId,
        dictKeysCount: Object.keys(dict).length,
        keyInDict: key in dict,
        allGuidsInDict: Object.keys(dict).filter(k => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)),
        sampleDictKeys: Object.keys(dict).slice(0, 10),
        actionInstanceIdInDict: action.actionInstanceId ? (action.actionInstanceId in dict) : false
      });
    }
  } else {
    console.warn('[DEBUG][RESOLVE_ACTION] ❌ No key found in parameters', {
      actionId: action.actionId,
      actionInstanceId: action.actionInstanceId,
      hasParameters: !!action.parameters,
      parameters: action.parameters
    });
  }

  return undefined;
}
