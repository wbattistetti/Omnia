/**
 * Numerazione stabile use case (1..N) per deploy, log runtime e appendix agente virtuale.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';

/** Ordine catalogo: sort_order poi label (allineato a proiezione conversazionale / runtime). */
export function sortUseCasesForCatalogNumbering(
  useCases: readonly AIAgentUseCase[]
): AIAgentUseCase[] {
  return [...useCases].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return (a.label ?? '').localeCompare(b.label ?? '', undefined, { sensitivity: 'base' });
  });
}

/** Mappa `use_case_id` → numero catalogo 1-based (solo use case inclusi nel set passato). */
export function buildUseCaseCatalogNumberById(
  useCases: readonly AIAgentUseCase[]
): Map<string, number> {
  const sorted = sortUseCasesForCatalogNumbering(useCases);
  const map = new Map<string, number>();
  sorted.forEach((uc, i) => {
    map.set(uc.id, i + 1);
  });
  return map;
}

/**
 * Trace runtime da appendere alla risposta agente (`Task.agentLogUseCase`).
 * Formato: `USECASE: "<N> — <NOME>"` (numero + label in maiuscolo).
 */
export function buildUseCaseLogValue(catalogNumber: number, label: string): string {
  const n = Number.isFinite(catalogNumber) && catalogNumber > 0 ? Math.floor(catalogNumber) : 0;
  const name = label.trim().toLocaleUpperCase();
  if (n > 0 && name) return `USECASE: "${n} — ${name}"`;
  if (n > 0) return `USECASE: "${n}"`;
  if (name) return `USECASE: "${name}"`;
  return 'USECASE: ""';
}

/** Etichetta designer compatta per regole compile (es. «UC 3»). */
export function formatUseCaseCatalogNumberLabel(catalogNumber: number): string {
  const n = Number.isFinite(catalogNumber) && catalogNumber > 0 ? Math.floor(catalogNumber) : 0;
  return n > 0 ? `UC ${n}` : 'UC';
}

/**
 * Etichetta lista designer allineata al trace log (`N — NOME`), senza forzare maiuscolo.
 */
export function formatUseCaseCatalogListLabel(
  catalogNumber: number | undefined,
  label: string
): string {
  const n =
    typeof catalogNumber === 'number' && Number.isFinite(catalogNumber) && catalogNumber > 0
      ? Math.floor(catalogNumber)
      : 0;
  const name = (label ?? '').trim() || '—';
  if (n > 0) return `${n} — ${name}`;
  return name;
}
