/**
 * Chunked use-case bundle generation limits (mirrors backend useCaseBundleChunkConfig.js).
 */

export const USE_CASE_BUNDLE_CHUNK_SIZE = 5;
export const USE_CASE_BUNDLE_MAX_TOTAL = 15;
/** Allineato a `USE_CASE_JSON_PARSE_MAX_ATTEMPTS` nel backend. */
export const USE_CASE_BUNDLE_JSON_PARSE_MAX_ATTEMPTS = 3;

/** Messaggio quando un batch extend fallisce ma restano scenari già generati. */
export function formatUseCaseExtendBatchFailureMessage(
  existingCount: number,
  cause: unknown
): string {
  const detail =
    cause instanceof Error
      ? cause.message.replace(/^Model returned non-JSON:\s*/i, '').slice(0, 160)
      : String(cause).slice(0, 160);
  return (
    `Generati ${existingCount} scenari; un batch successivo non è riuscito ` +
    `(dopo ${USE_CASE_BUNDLE_JSON_PARSE_MAX_ATTEMPTS} tentativi). ` +
    `Salva il risultato e usa «Crea altri use case» per continuare.` +
    (detail ? ` Dettaglio: ${detail}` : '')
  );
}

/** Label for generate buttons while scenarios are being created. */
export function formatGeneratingUseCasesLabel(count: number): string {
  return `Generando use case… (${count})`;
}

export const LABEL_ORDERING_USE_CASES = 'Ordinamento use case…';

/** Testo pulsante durante generazione chunked o riordino finale. */
export function resolveUseCaseBundleGeneratingLabel(
  count: number | null,
  ordering: boolean
): string {
  if (ordering) return LABEL_ORDERING_USE_CASES;
  if (count != null && count >= 0) return formatGeneratingUseCasesLabel(count);
  return 'Generando use case…';
}

/**
 * Messaggio tutor in cima alla lista (o empty state) mentre il bundle è in corso.
 */
export function formatUseCaseBundleProgressBanner(
  count: number | null,
  ordering: boolean
): string {
  if (ordering) {
    return 'Sto riordinando gli use case per metterli in sequenza logica… Ti avviso quando ho finito.';
  }
  if (count != null && count > 0) {
    const noun = count === 1 ? 'use case' : 'use case';
    return `Ho generato intanto ${count} ${noun}, ne sto generando altri… Ti avviso quando ho finito.`;
  }
  return 'Sto generando gli use case… Ti avviso quando ho finito.';
}
