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
  'rounded-lg border border-slate-300/80 bg-white/90 text-slate-900 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)] dark:border-slate-600/65 dark:bg-slate-900/40 dark:text-slate-100 dark:shadow-[inset_0_0_0_1px_rgba(148,163,184,0.06)]';

/** Lista accordion use case: scroll verticale sempre attivo se il contenuto supera l’area (wizard). */
export const UC_USE_CASE_LIST_SCROLL =
  'overflow-y-scroll [scrollbar-gutter:stable] [scrollbar-color:rgba(100,116,139,0.55)_rgb(248,250,252)] dark:[scrollbar-color:rgba(100,116,139,0.75)_rgba(15,23,42,0.95)]';

/**
 * Corpo espanso dell’accordion in wizard: stesso family slate/violet della lista, senza
 * salti cromatici verso altre tinte.
 */
export const UC_WIZARD_CARD_BODY =
  'border-t border-slate-200/70 bg-slate-50/75 px-2 py-2 space-y-2 dark:border-slate-700/45 dark:bg-slate-950/22';

/**
 * Superficie pastello viola del blocco scenario (senza radius: il chiamante imposta rounded-md / rounded-lg).
 */
export const UC_SCENARIO_PANEL_SURFACE =
  'border border-violet-200/65 bg-violet-100/55 px-2 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:border-violet-500/22 dark:bg-violet-950/38 dark:shadow-[inset_0_1px_0_rgba(0,0,0,0.15)]';

/** Riquadro scenario in lista wizard / accordion compatto. */
export const UC_WIZARD_SCENARIO_BLOCK = `rounded-md ${UC_SCENARIO_PANEL_SURFACE}`;

/** Zebratura righe lista in wizard: solo viola/slate, niente contrasti «carnevale». */
export const UC_LIST_ZEBRA_WIZARD_EVEN =
  'border-violet-200/50 bg-violet-50/65 transition-colors hover:bg-violet-100/80 dark:border-violet-900/28 dark:bg-violet-950/18 dark:hover:bg-violet-900/26';
export const UC_LIST_ZEBRA_WIZARD_ODD =
  'border-slate-200/55 bg-slate-100/60 transition-colors hover:bg-violet-50/85 dark:border-slate-700/32 dark:bg-slate-900/28 dark:hover:bg-slate-800/38';

/** Zebratura in vista classica (non wizard): neutra slate/bianco. */
export const UC_LIST_ZEBRA_CLASSIC_EVEN =
  'border-slate-300/60 bg-slate-50 transition-colors hover:bg-violet-100/70 dark:border-slate-600/45 dark:bg-slate-900/35 dark:hover:bg-slate-700/50';
export const UC_LIST_ZEBRA_CLASSIC_ODD =
  'border-slate-300/60 bg-white transition-colors hover:bg-violet-100/70 dark:border-slate-600/45 dark:bg-slate-800/40 dark:hover:bg-slate-700/50';

export const UC_PILL_SCENARIO =
  'inline-flex shrink-0 select-none items-center rounded-full border border-violet-500/45 bg-violet-950/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-100';
export const UC_PILL_AGENT_MSG =
  'inline-flex shrink-0 select-none items-center rounded-full border border-emerald-600/50 bg-emerald-950/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100';
/** Corpo scenario: ~1px sotto `text-sm` del messaggio agente (textarea classica). */
export const UC_SCENARIO_BODY_TEXT = 'text-[13px] leading-snug';
export const UC_CLASSIC_TEXTAREA_SCENARIO =
  `min-w-0 flex-1 rounded-md border border-violet-500/50 bg-slate-900/95 px-2 py-1.5 ${UC_SCENARIO_BODY_TEXT} text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-60`;
export const UC_CLASSIC_TEXTAREA_AGENT =
  'min-w-0 flex-1 rounded-md border border-emerald-500/50 bg-emerald-950/50 px-2 py-1.5 font-mono text-sm leading-snug text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-emerald-300/45 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60';

export const UC_SCENARIO_ROW_EDIT_BTN =
  'shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:text-violet-300 group-hover/payoff-row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:opacity-40';
export const UC_AGENT_ROW_EDIT_BTN =
  'shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:text-violet-300 group-hover/agentmsg-row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40';

export const UC_HEAD_VOTE_BTN =
  'shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-slate-200/90 dark:hover:bg-slate-800/80 group-hover/uc-head:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/55 disabled:opacity-40';
export const UC_SCENARIO_VOTE_BTN =
  'shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-slate-200/90 dark:hover:bg-slate-800/80 group-hover/payoff-row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/55 disabled:opacity-40';
export const UC_AGENT_VOTE_BTN =
  'shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-slate-200/90 dark:hover:bg-slate-800/80 group-hover/agentmsg-row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 disabled:opacity-40';

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
      ? 'bg-emerald-200/90 hover:bg-emerald-200 dark:bg-emerald-900/55 dark:hover:bg-emerald-900/65'
      : 'bg-emerald-100/85 hover:bg-emerald-200/90 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/45';
  }
  if (vote === 'down') {
    return active
      ? 'bg-rose-200/90 hover:bg-rose-200 dark:bg-rose-900/55 dark:hover:bg-rose-900/65'
      : 'bg-rose-100/85 hover:bg-rose-200/90 dark:bg-rose-950/40 dark:hover:bg-rose-900/45';
  }
  return active
    ? 'bg-violet-200/80 dark:bg-violet-900/40'
    : 'hover:bg-slate-200/90 dark:hover:bg-slate-800/80';
}
