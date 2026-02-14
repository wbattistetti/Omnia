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
    return localeTranslations as Record<string, string>;
  }

  // No translations provided - return empty (translations should always come from global table)
  console.warn('[DDTAdapter][extractTranslations] ⚠️ No translations provided - translations should come from global table');
  return {};
}

export function getStepsArray(node: any): StepGroup[] {
  if (!node) return [];
  // ✅ RETROCOMPATIBILITÀ: Gestisce formato array legacy (solo per ChatSimulator che può ricevere dati legacy)
  if (Array.isArray(node.steps)) {
    console.warn('[DDTAdapter.getStepsArray] Received array format for steps, expected dictionary. Converting...');
    return node.steps.map((s: any) => ({
      type: s.type ?? s.stepType ?? 'start',
      escalations: s.escalations ?? []
    }));
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
  // ✅ NO FALLBACKS: tasks can be undefined (legitimate default)
  return esc?.tasks ?? [];
}

// Legacy alias for backward compatibility (will be removed)
export const getEscalationActions = getEscalationTasks;

export function resolveTaskText(task: any, dict: Record<string, string>): string | undefined {
  if (!task) {
    return undefined;
  }

  // ✅ FASE 3: Rimuovere fallback task.text - il task deve contenere solo GUID
  // ❌ RIMOSSO: Priority: task.text (edited text in DDT instance) > dict[key] (translation)
  // Il modello corretto è: task contiene solo GUID, traduzione in dict

  const p = Array.isArray(task.parameters) ? task.parameters.find((x: any) => (x?.parameterId || x?.key) === 'text') : undefined;
  const key = p?.value;

  if (!key) {
    return undefined;
  }

  // ✅ LOG: Chiave trovata
  console.log('[Translation] 🔑 Key found:', key);

  const found = dict[key];

  if (found) {
    // ✅ LOG: Traduzione trovata
    console.log('[Translation] ✅ Translation found:', {
      key,
      text: found.substring(0, 100) + (found.length > 100 ? '...' : '')
    });
    return found;
  } else {
    // ✅ LOG: Traduzione NON trovata (solo warning, non verbose)
    console.warn('[Translation] ❌ NOT FOUND:', key);
  }

  return undefined;
}

// Legacy alias for backward compatibility (will be removed)
export const resolveActionText = resolveTaskText;
