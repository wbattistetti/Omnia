/**
 * Aggiornamenti immutabili sulla prima frase: modalità messaggio parametrico (dimensioni +
 * griglia combinazioni → proiezione `variants[]` deploy).
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type {
  AIAgentCanonicalPhrase,
  AIAgentPhraseParametricConfig,
  AIAgentPhraseParametricDimension,
  AIAgentPhraseParametricRow,
} from './schema';
import { ensureUseCasePhrases } from './migrateUseCase';
import { CORE_SLOT_IDS } from './projectSlotLexicon';
import { variantNaturalText } from './semanticCompile';

/** Opzioni UI / dropdown: parametri catalogo slot core. */
export const PARAMETRIC_CATALOG_DIMENSIONS: ReadonlyArray<{ key: string; label: string }> =
  CORE_SLOT_IDS.map((k) => ({
    key: k,
    label: k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, ' $1'),
  }));

function newId(prefix: string): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `${prefix}_${crypto.randomUUID().slice(0, 8)}`
    : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function stripCompiledFromVariants(phrase: AIAgentCanonicalPhrase): AIAgentCanonicalPhrase {
  return {
    ...phrase,
    variants: phrase.variants.map((v) =>
      v.variantId === 'default'
        ? { ...v, compiled: undefined }
        : { ...v, compiled: undefined, naturalText: v.naturalText }
    ),
  };
}

function ensureParametric(cfg?: AIAgentPhraseParametricConfig): AIAgentPhraseParametricConfig {
  return {
    enabled: cfg?.enabled ?? false,
    dimensions: [...(cfg?.dimensions ?? [])],
    rows: (cfg?.rows ?? []).map((r) => ({
      ...r,
      valuesByDimensionId: { ...r.valuesByDimensionId },
    })),
  };
}

/** Clausola `when` sintetica per il motore: `dimension=valore` ripetuti. */
export function buildParametricWhenClause(
  dims: readonly AIAgentPhraseParametricDimension[],
  valuesByDimensionId: Readonly<Record<string, string>>
): string {
  const parts: string[] = [];
  for (const d of dims) {
    const raw = valuesByDimensionId[d.dimensionId];
    const v = typeof raw === 'string' ? raw.trim() : '';
    const label =
      (d.kind === 'catalog' && d.catalogKey ? d.catalogKey : d.label)?.trim() || d.dimensionId;
    if (!v) continue;
    parts.push(`${label}=${v}`);
  }
  return parts.join('; ');
}

export function patchPrimaryPhrase(
  uc: AIAgentUseCase,
  phrasePatcher: (p: AIAgentCanonicalPhrase) => AIAgentCanonicalPhrase
): AIAgentUseCase {
  const base = ensureUseCasePhrases(uc);
  const phrases = [...(base.phrases ?? [])];
  if (phrases.length === 0) return base;
  phrases[0] = phrasePatcher(phrases[0]);
  return { ...base, phrases };
}

function defaultDeployNaturalText(phrase: AIAgentCanonicalPhrase): string {
  const def = phrase.variants.find((v) => v.variantId === 'default');
  if (!def) return phrase.naturalText;
  return variantNaturalText(phrase, def);
}

/** Prima riga griglia: prompt = template deploy default (canonico + variante default). */
function seedParametricRowsIfEmpty(
  phrase: AIAgentCanonicalPhrase,
  cfg: AIAgentPhraseParametricConfig
): void {
  if (cfg.rows.length > 0) return;
  cfg.rows.push({
    rowId: newId('prow'),
    valuesByDimensionId: Object.fromEntries(cfg.dimensions.map((d) => [d.dimensionId, ''])),
    promptNaturalText: defaultDeployNaturalText(phrase),
  });
}

export function setPrimaryPhraseParametricEnabled(
  uc: AIAgentUseCase,
  enabled: boolean
): AIAgentUseCase {
  return patchPrimaryPhrase(uc, (p0) => {
    const cfg = ensureParametric(p0.parametric);
    cfg.enabled = enabled;
    if (enabled && cfg.dimensions.length === 0) {
      cfg.rows = [];
    }
    return stripCompiledFromVariants({
      ...p0,
      parametric: cfg,
    });
  });
}

/**
 * Disattiva il parametrico: il testo della riga scelta diventa l'unico messaggio canonico;
 * griglia e dimensioni vengono svuotate.
 */
export function applyParametricRevertToSingleMessage(
  uc: AIAgentUseCase,
  selectedRowId: string
): AIAgentUseCase {
  return patchPrimaryPhrase(uc, (p0) => {
    const cfg = ensureParametric(p0.parametric);
    const row = cfg.rows.find((r) => r.rowId === selectedRowId);
    const chosenText = (row?.promptNaturalText ?? '').trim() || p0.naturalText;
    return stripCompiledFromVariants({
      ...p0,
      naturalText: chosenText,
      parametric: {
        enabled: false,
        dimensions: [],
        rows: [],
      },
    });
  });
}

export function addParametricCatalogDimension(uc: AIAgentUseCase, catalogKey: string): AIAgentUseCase {
  const base = ensureUseCasePhrases(uc);
  const phrase0 = base.phrases?.[0];
  const existing = phrase0?.parametric?.dimensions ?? [];
  if (existing.some((d) => d.kind === 'catalog' && d.catalogKey === catalogKey)) {
    return uc;
  }

  const label =
    PARAMETRIC_CATALOG_DIMENSIONS.find((x) => x.key === catalogKey)?.label ?? catalogKey;
  const dim: AIAgentPhraseParametricDimension = {
    dimensionId: newId('dim'),
    kind: 'catalog',
    catalogKey,
    label,
  };
  return patchPrimaryPhrase(uc, (p0) => {
    const cfg = ensureParametric(p0.parametric);
    cfg.dimensions = [...cfg.dimensions, dim];
    if (cfg.rows.length === 0) {
      seedParametricRowsIfEmpty(p0, cfg);
    } else {
      cfg.rows = cfg.rows.map((r) => ({
        ...r,
        valuesByDimensionId: { ...r.valuesByDimensionId, [dim.dimensionId]: '' },
      }));
    }
    return stripCompiledFromVariants({ ...p0, parametric: cfg });
  });
}

/** Parametro libero: `label` iniziale vuota; colonne placeholder = label quando valorizzata. */
export function addParametricFreeDimension(uc: AIAgentUseCase): AIAgentUseCase {
  const dim: AIAgentPhraseParametricDimension = {
    dimensionId: newId('dim'),
    kind: 'free',
    label: '',
  };
  return patchPrimaryPhrase(uc, (p0) => {
    const cfg = ensureParametric(p0.parametric);
    cfg.dimensions = [...cfg.dimensions, dim];
    if (cfg.rows.length === 0) {
      seedParametricRowsIfEmpty(p0, cfg);
    } else {
      cfg.rows = cfg.rows.map((r) => ({
        ...r,
        valuesByDimensionId: { ...r.valuesByDimensionId, [dim.dimensionId]: '' },
      }));
    }
    return stripCompiledFromVariants({ ...p0, parametric: cfg });
  });
}

export function removeParametricDimension(uc: AIAgentUseCase, dimensionId: string): AIAgentUseCase {
  return patchPrimaryPhrase(uc, (p0) => {
    const cfg = ensureParametric(p0.parametric);
    cfg.dimensions = cfg.dimensions.filter((d) => d.dimensionId !== dimensionId);
    cfg.rows = cfg.rows.map((r) => {
      const vals = { ...r.valuesByDimensionId };
      delete vals[dimensionId];
      return { ...r, valuesByDimensionId: vals };
    });
    return stripCompiledFromVariants({ ...p0, parametric: cfg });
  });
}

export function patchParametricDimensionLabel(
  uc: AIAgentUseCase,
  dimensionId: string,
  label: string
): AIAgentUseCase {
  return patchPrimaryPhrase(uc, (p0) => {
    const cfg = ensureParametric(p0.parametric);
    cfg.dimensions = cfg.dimensions.map((d) =>
      d.dimensionId === dimensionId ? { ...d, label } : d
    );
    return stripCompiledFromVariants({ ...p0, parametric: cfg });
  });
}

export function addParametricRow(uc: AIAgentUseCase): AIAgentUseCase {
  return patchPrimaryPhrase(uc, (p0) => {
    const cfg = ensureParametric(p0.parametric);
    const values: Record<string, string> = {};
    for (const d of cfg.dimensions) values[d.dimensionId] = '';
    cfg.rows = [
      ...cfg.rows,
      {
        rowId: newId('prow'),
        valuesByDimensionId: values,
        promptNaturalText: '',
      },
    ];
    return stripCompiledFromVariants({ ...p0, parametric: cfg });
  });
}

export function removeParametricRow(uc: AIAgentUseCase, rowId: string): AIAgentUseCase {
  return patchPrimaryPhrase(uc, (p0) => {
    const cfg = ensureParametric(p0.parametric);
    cfg.rows = cfg.rows.filter((r) => r.rowId !== rowId);
    return stripCompiledFromVariants({ ...p0, parametric: cfg });
  });
}

export function patchParametricRowCell(
  uc: AIAgentUseCase,
  rowId: string,
  dimensionId: string,
  value: string
): AIAgentUseCase {
  return patchPrimaryPhrase(uc, (p0) => {
    const cfg = ensureParametric(p0.parametric);
    cfg.rows = cfg.rows.map((r) =>
      r.rowId !== rowId
        ? r
        : {
            ...r,
            valuesByDimensionId: { ...r.valuesByDimensionId, [dimensionId]: value },
          }
    );
    return stripCompiledFromVariants({ ...p0, parametric: cfg });
  });
}

export function patchParametricRowPrompt(
  uc: AIAgentUseCase,
  rowId: string,
  promptNaturalText: string
): AIAgentUseCase {
  return patchPrimaryPhrase(uc, (p0) => {
    const cfg = ensureParametric(p0.parametric);
    cfg.rows = cfg.rows.map((r) =>
      r.rowId !== rowId ? r : { ...r, promptNaturalText }
    );
    return stripCompiledFromVariants({ ...p0, parametric: cfg });
  });
}

/**
 * Cartesian product: univoci per dimensione estratti dalle righe attuali → tutte le tuple.
 */
export function expandParametricCartesian(uc: AIAgentUseCase): { uc: AIAgentUseCase; error?: string } {
  const base = ensureUseCasePhrases(uc);
  const p0 = base.phrases?.[0];
  if (!p0) return { uc: base };
  const cfg = ensureParametric(p0.parametric);
  const dims = cfg.dimensions;
  if (dims.length === 0) {
    return { uc: base, error: 'Aggiungi almeno un parametro.' };
  }

  const domainByDim = dims.map(() => new Set<string>());
  for (const r of cfg.rows) {
    dims.forEach((d, i) => {
      const v = (r.valuesByDimensionId[d.dimensionId] ?? '').trim();
      if (v) domainByDim[i]?.add(v);
    });
  }
  const domains = domainByDim.map((s) => [...s]);
  if (domains.some((a) => a.length === 0)) {
    return {
      uc: base,
      error:
        'Per generare tutte le combinazioni ogni parametro deve avere almeno un valore nelle righe attuali.',
    };
  }

  const tuples: string[][] = [];
  function recurse(idx: number, acc: string[]): void {
    if (idx === dims.length) {
      tuples.push([...acc]);
      return;
    }
    for (const val of domains[idx]!) recurse(idx + 1, [...acc, val]);
  }
  recurse(0, []);

  const newRows: AIAgentPhraseParametricRow[] = tuples.map((vals) => {
    const valuesByDimensionId: Record<string, string> = {};
    dims.forEach((d, i) => {
      valuesByDimensionId[d.dimensionId] = vals[i] ?? '';
    });
    const existing = cfg.rows.find((r) =>
      dims.every(
        (d) =>
          (r.valuesByDimensionId[d.dimensionId] ?? '').trim() ===
          valuesByDimensionId[d.dimensionId]?.trim()
      )
    );
    return {
      rowId: newId('prow'),
      valuesByDimensionId,
      promptNaturalText: existing?.promptNaturalText ?? '',
    };
  });

  cfg.rows = newRows;
  const nextPhrase = stripCompiledFromVariants({ ...p0, parametric: cfg });
  const phrases = [...(base.phrases ?? [])];
  phrases[0] = nextPhrase;
  return { uc: { ...base, phrases } };
}