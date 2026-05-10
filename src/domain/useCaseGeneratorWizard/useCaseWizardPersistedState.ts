/**
 * Snapshot wizard use case (pipeline + baseline IA) persistito sul Task — ripresa sessione dopo salvataggio progetto.
 */

export const USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION = 1 as const;

export interface UseCaseWizardPersistedStateV1 {
  schemaVersion: typeof USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION;
  enabled?: boolean;
  stepIndex: number;
  unlockedMaxStepIndex?: number;
  /** Serializzazione lista use case per confronto dirty passo 1 (`serializeUseCaseListForWizardBaseline`). */
  useCaseListBaseline?: string;
  /** Testo assistente per id al momento dell’ultimo capture passo 2. */
  examplePhraseBaselineById?: Record<string, string>;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Legge JSON dal Task; tollera assenza o legacy senza schemaVersion.
 */
export function parseUseCaseWizardPersistedState(raw: string | undefined | null): UseCaseWizardPersistedStateV1 | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!isRecord(v)) return null;
    /** Legacy sessionStorage: solo step/unlocked/enabled (senza schemaVersion né baseline). */
    if (v.schemaVersion === undefined && typeof v.stepIndex === 'number') {
      const stepIndex =
        v.stepIndex >= 0 && v.stepIndex < 32 ? Math.floor(v.stepIndex) : 0;
      let unlockedMaxStepIndex =
        typeof v.unlockedMaxStepIndex === 'number' ? Math.floor(v.unlockedMaxStepIndex) : 0;
      if (stepIndex > unlockedMaxStepIndex) unlockedMaxStepIndex = stepIndex;
      return {
        schemaVersion: 1,
        enabled: typeof v.enabled === 'boolean' ? v.enabled : true,
        stepIndex,
        unlockedMaxStepIndex,
      };
    }
    const schemaVersion =
      typeof v.schemaVersion === 'number' ? v.schemaVersion : USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION;
    if (schemaVersion !== 1) return null;
    const stepIndex =
      typeof v.stepIndex === 'number' && v.stepIndex >= 0 && v.stepIndex <= 20 ? Math.floor(v.stepIndex) : 0;
    const unlockedMaxStepIndex =
      typeof v.unlockedMaxStepIndex === 'number' && v.unlockedMaxStepIndex >= 0 && v.unlockedMaxStepIndex <= 20
        ? Math.floor(v.unlockedMaxStepIndex)
        : 0;
    const enabled = typeof v.enabled === 'boolean' ? v.enabled : true;
    const useCaseListBaseline =
      typeof v.useCaseListBaseline === 'string' ? v.useCaseListBaseline : undefined;
    let examplePhraseBaselineById: Record<string, string> | undefined;
    if (v.examplePhraseBaselineById && isRecord(v.examplePhraseBaselineById)) {
      const o: Record<string, string> = {};
      for (const [k, val] of Object.entries(v.examplePhraseBaselineById)) {
        if (typeof val === 'string') o[k] = val;
      }
      if (Object.keys(o).length > 0) examplePhraseBaselineById = o;
    }
    return {
      schemaVersion: 1,
      enabled,
      stepIndex,
      unlockedMaxStepIndex,
      ...(useCaseListBaseline !== undefined ? { useCaseListBaseline } : {}),
      ...(examplePhraseBaselineById !== undefined ? { examplePhraseBaselineById } : {}),
    };
  } catch {
    return null;
  }
}

export function serializeUseCaseWizardPersistedState(state: UseCaseWizardPersistedStateV1): string {
  return JSON.stringify(state);
}
