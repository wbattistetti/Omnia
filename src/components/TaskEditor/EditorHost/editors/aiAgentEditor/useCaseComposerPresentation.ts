/**
 * Classi Tailwind e helper colore testo per il composer use case (baseline IA vs voto designer).
 */

/** Snapshot triplet per confronto edit vs ultima linea IA generata. */
export type AiTripletFieldBaseline = {
  label: string;
  payoff: string;
  assistantContent: string;
};

export const USE_CASE_PANEL_SHELL =
  'rounded-lg border border-slate-600/65 bg-slate-900/40 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.06)]';

/** Lista accordion use case: scroll verticale sempre attivo se il contenuto supera l’area (wizard). */
export const UC_USE_CASE_LIST_SCROLL =
  'overflow-y-scroll [scrollbar-gutter:stable] [scrollbar-color:rgba(100,116,139,0.75)_rgba(15,23,42,0.95)]';

export const UC_PILL_SCENARIO =
  'inline-flex shrink-0 select-none items-center rounded-full border border-violet-500/45 bg-violet-950/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-100';
export const UC_PILL_AGENT_MSG =
  'inline-flex shrink-0 select-none items-center rounded-full border border-emerald-600/50 bg-emerald-950/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100';
export const UC_CLASSIC_TEXTAREA_SCENARIO =
  'min-w-0 flex-1 rounded-md border border-violet-500/50 bg-slate-900/95 px-2 py-1.5 text-xs leading-snug text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-60';
export const UC_CLASSIC_TEXTAREA_AGENT =
  'min-w-0 flex-1 rounded-md border border-emerald-500/50 bg-emerald-950/50 px-2 py-1.5 font-mono text-sm leading-snug text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-emerald-300/45 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60';

export const UC_SCENARIO_ROW_EDIT_BTN =
  'shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:text-violet-300 group-hover/payoff-row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:opacity-40';
export const UC_AGENT_ROW_EDIT_BTN =
  'shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:text-violet-300 group-hover/agentmsg-row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40';

export const UC_HEAD_VOTE_BTN =
  'shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-slate-800/80 group-hover/uc-head:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/55 disabled:opacity-40';
export const UC_SCENARIO_VOTE_BTN =
  'shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-slate-800/80 group-hover/payoff-row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/55 disabled:opacity-40';
export const UC_AGENT_VOTE_BTN =
  'shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-slate-800/80 group-hover/agentmsg-row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 disabled:opacity-40';

export function aiFieldToneClass(current: string, baseline: string | undefined): string {
  if (baseline === undefined) return 'text-slate-500';
  return current === baseline ? 'text-slate-500' : 'text-emerald-400';
}

/** Colore testo: pollice (verde/rosso) ha priorità su baseline IA. */
export function fieldTextClass(
  vote: 'up' | 'down' | undefined,
  current: string,
  baseline: string | undefined
): string {
  if (vote === 'up') return 'text-emerald-400';
  if (vote === 'down') return 'text-red-400';
  return aiFieldToneClass(current, baseline);
}

/**
 * Background della barra header del use case nella lista, derivato dal voto «di validazione»
 * (single source of truth: `designer_label_vote`). Tre stati visivi:
 *
 *  - `'up'`   → tonalità verde (use case validato);
 *  - `'down'` → tonalità rossa (use case invalidato);
 *  - `undefined` → comportamento neutro precedente (violet su selezione, slate hover).
 *
 * La selezione attiva (`active`) influisce sull'opacità del background per restare
 * distinguibile rispetto al hover. Volutamente non mostriamo un terzo «strato» quando il
 * voto è espresso *e* la riga è attiva: il colore di voto è semanticamente prioritario.
 */
export function useCaseHeaderBgClass(
  vote: 'up' | 'down' | undefined,
  active: boolean
): string {
  if (vote === 'up') {
    return active
      ? 'bg-emerald-900/55 hover:bg-emerald-900/65'
      : 'bg-emerald-950/40 hover:bg-emerald-900/45';
  }
  if (vote === 'down') {
    return active
      ? 'bg-rose-900/55 hover:bg-rose-900/65'
      : 'bg-rose-950/40 hover:bg-rose-900/45';
  }
  return active ? 'bg-violet-900/40' : 'hover:bg-slate-800/80';
}
