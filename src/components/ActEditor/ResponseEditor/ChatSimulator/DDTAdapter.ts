export type Escalation = { tasks: any[] };
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
        return { type: k, escalations: [ { tasks: v } ] };
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

export function getEscalationTasks(node: any, stepType: string, level: number): any[] {
  const sg = getStepGroup(node, stepType);
  const esc = sg?.escalations?.[level - 1];
  return esc?.tasks || [];
}

// Legacy alias for backward compatibility (will be removed)
export const getEscalationActions = getEscalationTasks;

export function resolveTaskText(task: any, dict: Record<string, string>): string | undefined {
  if (!task) {
    console.warn('[DEBUG][RESOLVE_TASK] ❌ Task is null/undefined');
    return undefined;
  }

  // Priority: task.text (edited text in DDT instance) > dict[key] (old translation values)
  if (task.text && typeof task.text === 'string' && task.text.trim().length > 0) {
    console.log('[DEBUG][RESOLVE_TASK] ✅ Using task.text directly', {
      text: task.text.substring(0, 50),
      textLength: task.text.length
    });
    return task.text;
  }

  console.log('[DEBUG][RESOLVE_TASK] 🔍 Resolving from dict', {
    templateId: task.templateId,
    taskId: task.taskId,
    hasParameters: !!task.parameters,
    parametersCount: task.parameters?.length || 0,
    parameters: task.parameters?.map((p: any) => ({
      parameterId: p.parameterId,
      key: p.key,
      value: p.value,
      valueType: typeof p.value,
      isGuid: p.value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.value)
    })) || [],
    dictKeysCount: Object.keys(dict).length,
    sampleDictKeys: Object.keys(dict).slice(0, 10)
  });

  const p = Array.isArray(task.parameters) ? task.parameters.find((x: any) => (x?.parameterId || x?.key) === 'text') : undefined;
  const key = p?.value;

  console.log('[DEBUG][RESOLVE_TASK] 🔍 Text parameter found', {
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

    console.log('[DEBUG][RESOLVE_TASK] 🔍 Looking up in dict', {
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
      console.log('[DEBUG][RESOLVE_TASK] ✅ Translation found', {
        key,
        value: found.substring(0, 50),
        isGuid
      });
      return found;
    } else {
      console.warn('[DEBUG][RESOLVE_TASK] ❌ Translation NOT found', {
        key,
        isGuid,
        taskId: task.taskId,
        dictKeysCount: Object.keys(dict).length,
        keyInDict: key in dict,
        allGuidsInDict: Object.keys(dict).filter(k => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)),
        sampleDictKeys: Object.keys(dict).slice(0, 10),
        taskIdInDict: task.taskId ? (task.taskId in dict) : false
      });
    }
  } else {
    console.warn('[DEBUG][RESOLVE_TASK] ❌ No key found in parameters', {
      templateId: task.templateId,
      taskId: task.taskId,
      hasParameters: !!task.parameters,
      parameters: task.parameters
    });
  }

  return undefined;
}

// Legacy alias for backward compatibility (will be removed)
export const resolveActionText = resolveTaskText;
