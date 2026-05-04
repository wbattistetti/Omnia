/**
 * Persisted advancement configuration for Backend Call SEND parameters (design-time + runtime hints).
 */

import type { AdvancementValueType } from './advancementDsl';

export interface BackendInputAdvancementEntry {
  enabled: boolean;
  /** Last natural-language hint (optional; executable source is dslExpression). */
  naturalLanguage?: string;
  /** Validated advancement DSL executed by Omnia at batch boundaries. */
  dslExpression: string;
  /**
   * NL salvato all’ultimo **Crea/Affina script** riuscito (coerente con `dslExpression` prodotto dall’IA).
   * Assente su task legacy: nessun avviso finché non si rigenera da IA.
   */
  naturalLanguageAlignedWithScript?: string;
  /**
   * True se l’utente ha modificato `dslExpression` in Monaco dopo l’ultimo allineamento IA.
   */
  dslManuallyEditedAfterAlign?: boolean;
}

/**
 * True se lo script non è più da considerare allineato alla descrizione (NL diversa da ultimo align IA,
 * o edit manuale del codice). Usato solo con editor visibile; non blocca il runtime batch.
 */
export function isAdvancementNlScriptOutOfSync(entry: BackendInputAdvancementEntry): boolean {
  const dsl = (entry.dslExpression ?? '').trim();
  if (!dsl) return false;
  if (entry.dslManuallyEditedAfterAlign) return true;
  const aligned = entry.naturalLanguageAlignedWithScript;
  if (aligned === undefined) return false;
  const nl = (entry.naturalLanguage ?? '').trim();
  return nl !== aligned.trim();
}

export interface BackendAdvancementPersistedSlice {
  inputAdvancement?: Record<string, BackendInputAdvancementEntry>;
  inputAdvancementTypes?: Record<string, AdvancementValueType>;
  /** JSON string: previous batch snapshot for editor "Test". */
  advancementTestPrevJson?: string;
}
