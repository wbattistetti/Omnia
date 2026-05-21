/**
 * Schema v2 del bundle use case agente (persistito in `Task.agentUseCasesJson`).
 * Versione ufficiale piattaforma — non estendere senza bump `USE_CASE_BUNDLE_SCHEMA_VERSION`.
 */

export const USE_CASE_BUNDLE_SCHEMA_VERSION = 3 as const;

/** @deprecated Leggere ancora bundle v2 in parse. */
export const USE_CASE_BUNDLE_SCHEMA_VERSION_V2 = 2 as const;

export type UseCaseBundleSchemaVersion = typeof USE_CASE_BUNDLE_SCHEMA_VERSION;

/** Mapping surface letterale → slot_id canonico (design-time). */
export interface SlotSurfaceMapping {
  surface: string;
  slot_id: string;
  /** Se true, non aggiorna il lessico globale del progetto. */
  localOnly?: boolean;
}

export interface PhraseCompiledSnapshot {
  tokenizedText: string;
  tokens: string[];
  mappings: SlotSurfaceMapping[];
  /** `fresh` | `stale` rispetto a naturalText o lessico progetto. */
  status: 'fresh' | 'stale';
  compiledAt: string;
}

/** Variante strutturale di una frase (es. prima visita vs controllo). */
export interface AIAgentPhraseVariant {
  variantId: string;
  /** Testo naturale se diverso dalla frase base; altrimenti eredita `phrase.naturalText`. */
  naturalText?: string;
  when?: string;
  compiled?: PhraseCompiledSnapshot;
}

/**
 * Dimensione dichiarativa per messaggio parametrico (design-time catalogo combinazioni → prompt).
 */
export interface AIAgentPhraseParametricDimension {
  dimensionId: string;
  /** `catalog` = etichetta slot noto; `free` = nome guida compilabile dal designer → placeholder celle valore. */
  kind: 'catalog' | 'free';
  /** Solo se kind === `catalog`: chiave canonica (slot_id / CORE). */
  catalogKey?: string;
  /** Etichetta colonna / guida (`free`: testo placeholder per nome parametro). */
  label: string;
}

/** Una riga: valori per ogni dimensione + frase prompt per tale combinazione. */
export interface AIAgentPhraseParametricRow {
  rowId: string;
  /** Valori per dimensionId (chiave assente = cella vuota). */
  valuesByDimensionId: Record<string, string>;
  /** Template naturale della variante deploy per questa riga (con `[ ]` letterali come il canonico). */
  promptNaturalText: string;
}

export interface AIAgentPhraseParametricConfig {
  enabled: boolean;
  dimensions: AIAgentPhraseParametricDimension[];
  rows: AIAgentPhraseParametricRow[];
}

/**
 * Varianti di stile conversazionale per uno span `«defaultSurface»` nel naturalText.
 */
export interface AIAgentPhraseStyleToken {
  styleTokenId: string;
  /** Testo mostrato nel messaggio (contenuto tra « e »). */
  defaultSurface: string;
  /** Formulazioni alternative ammesse (include di norma {@link defaultSurface}). */
  variants: string[];
}

export type AIAgentPhraseStyleExampleSource =
  | 'combinatoric'
  | 'polish'
  | 'creative'
  | 'manual';

/** Esempio di frase validato a design-time (testo plain, senza delimitatori token). */
export interface AIAgentPhraseStyleExample {
  exampleId: string;
  plainText: string;
  /** Se true, incluso come esempio accettato (pollice su o checkbox). */
  accepted: boolean;
  source: AIAgentPhraseStyleExampleSource;
}

/** Frase canonica del designer (una o più per use case). */
export interface AIAgentCanonicalPhrase {
  phraseId: string;
  naturalText: string;
  localMappings?: SlotSurfaceMapping[];
  variants: AIAgentPhraseVariant[];
  /** Style token `«…»` con varianti editabili (design-time). */
  styleTokens?: AIAgentPhraseStyleToken[];
  /** Varianti di frase generate/validate a design-time. */
  styleExamples?: AIAgentPhraseStyleExample[];
  /**
   * Opzionale (schema v2+): quando `enabled`, le varianti deploy per questa frase derivano dalla
   * griglia combinazioni (+ variante default dal canonico), non dalla lista `variants` structural.
   */
  parametric?: AIAgentPhraseParametricConfig;
}

export interface UseCaseBundleV2Wrapper {
  useCaseBundleSchemaVersion: 2 | UseCaseBundleSchemaVersion;
  use_cases: unknown[];
  categories?: unknown[];
}

export interface UseCaseBundleDocument {
  useCaseBundleSchemaVersion: UseCaseBundleSchemaVersion;
  use_cases: unknown[];
  categories: unknown[];
}
