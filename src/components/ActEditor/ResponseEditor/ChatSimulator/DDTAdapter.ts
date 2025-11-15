export type Escalation = { actions: any[] };
export type StepGroup = { type: string; escalations: Escalation[] };

export function extractTranslations(ddt: any, translations?: any): Record<string, string> {
  // Priority 1: Use passed translations if it's a flat dictionary (already filtered by locale)
  // This is the case when translations comes from localTranslations in ResponseEditor
  if (translations && typeof translations === 'object') {
    // Check if it's a flat dictionary (not multilingual structure like { en: {...}, it: {...} })
    const isFlat = !translations.en && !translations.it && !translations.pt;
    if (isFlat) {
      // It's already filtered by locale, use it directly
      console.log('[DDTAdapter][extractTranslations] Using flat translations dictionary', {
        keysCount: Object.keys(translations).length,
        sampleKeys: Object.keys(translations).slice(0, 5),
        sampleValues: Object.entries(translations).slice(0, 3).map(([k, v]) => ({ key: k, value: String(v).substring(0, 30) }))
      });
      return translations as Record<string, string>;
    }
  }

  // Priority 2: Extract from DDT using project language
  const projectLang = (() => {
    try {
      return localStorage.getItem('project.lang') || 'en';
    } catch {
      return 'en';
    }
  })();

  // Extract from ddt.translations[projectLang] or fallback to en
  const fromDDT = ddt?.translations?.[projectLang] || ddt?.translations?.en || ddt?.translations || {};

  console.log('[DDTAdapter][extractTranslations] Extracted from DDT', {
    projectLang,
    hasDDTTranslations: !!ddt?.translations,
    hasProjectLang: !!(ddt?.translations?.[projectLang]),
    hasEn: !!(ddt?.translations?.en),
    fromDDTKeysCount: Object.keys(fromDDT).length,
    sampleKeys: Object.keys(fromDDT).slice(0, 5)
  });

  // Merge with passed translations (if multilingual structure)
  if (translations && typeof translations === 'object' && (translations.en || translations.it || translations.pt)) {
    const localeTranslations = translations[projectLang] || translations.en || {};
    return { ...fromDDT, ...localeTranslations };
  }

  return fromDDT as Record<string, string>;
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
  if (action.text && typeof action.text === 'string' && action.text.trim().length > 0) {
    return action.text;
  }

  const p = Array.isArray(action.parameters) ? action.parameters.find((x: any) => (x?.parameterId || x?.key) === 'text') : undefined;
  const key = p?.value;

  if (key) {
    const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
    const found = dict[key];

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
        sampleDictKeys: Object.keys(dict).slice(0, 10)
      });
    }
  }

  return undefined;
}
