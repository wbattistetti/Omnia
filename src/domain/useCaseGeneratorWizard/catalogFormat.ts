/**
 * Formati di export del catalogo use case nel prompt conversazionale (system prompt esterno).
 * Ogni formato serializza la stessa proiezione {@link UseCaseConversationalJson}; cambia solo
 * il rendering per token/costi/esperimenti A/B.
 */

/** Identificatore persistibile del formato catalogo nel prompt. */
export type ConversationalCatalogFormat =
  | 'json-pretty'
  | 'json-compact'
  | 'json-minimal'
  | 'dsl-standard'
  | 'dsl-ultra';

export interface ConversationalCatalogFormatOption {
  readonly id: ConversationalCatalogFormat;
  /** Etichetta estesa (descrizioni, tooltip). */
  readonly label: string;
  /** Etichetta compatta per pillole toolbar dialog. */
  readonly pillLabel: string;
  readonly description: string;
}

export const CONVERSATIONAL_CATALOG_FORMAT_OPTIONS: readonly ConversationalCatalogFormatOption[] =
  [
    {
      id: 'json-pretty',
      label: 'JSON completo',
      pillLabel: 'Completo',
      description: 'JSON indentato con tutti i campi (baseline, review designer).',
    },
    {
      id: 'json-compact',
      label: 'JSON compatto',
      pillLabel: 'Compatto',
      description: 'Schema snello senza id wizard; JSON su una riga per use case.',
    },
    {
      id: 'json-minimal',
      label: 'JSON minimo',
      pillLabel: 'Minimo',
      description: 'Chiavi corte (s, t, w); una riga JSON per use case.',
    },
    {
      id: 'dsl-standard',
      label: 'DSL',
      pillLabel: 'DSL',
      description: 'Blocchi testuali: scenario una volta, poi template.',
    },
    {
      id: 'dsl-ultra',
      label: 'DSL ultra',
      pillLabel: 'Ultra',
      description: 'Varianti compatte; scenario non ripetuto per ogni riga.',
    },
  ] as const;

export const DEFAULT_CONVERSATIONAL_CATALOG_FORMAT: ConversationalCatalogFormat = 'json-pretty';

export function isConversationalCatalogFormat(v: string): v is ConversationalCatalogFormat {
  return CONVERSATIONAL_CATALOG_FORMAT_OPTIONS.some((o) => o.id === v);
}

export function catalogFormatCatalogHeading(format: ConversationalCatalogFormat): string {
  switch (format) {
    case 'dsl-standard':
    case 'dsl-ultra':
      return 'Catalogo use case (DSL)';
    default:
      return 'Catalogo use case (JSON)';
  }
}
