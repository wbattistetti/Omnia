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

/** Lista accordion use case: scroll verticale; scrollbar più larga e visibile (Win/WebKit). */
export const UC_USE_CASE_LIST_SCROLL =
  'min-h-0 flex-1 basis-0 overflow-y-scroll overflow-x-hidden overscroll-contain pr-0.5 [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.75)_rgba(15,23,42,0.92)] dark:[scrollbar-color:rgba(148,163,184,0.85)_rgba(15,23,42,0.95)] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/75 [&::-webkit-scrollbar-thumb]:hover:bg-slate-400/85 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-900/80';

/**
 * Corpo espanso dell’accordion in wizard: neutro freddo (slate) per incorniciare scenario cobalto
 * e blocco parametrico grigio senza «arlecchino».
 */
export const UC_WIZARD_CARD_BODY =
  'border-t border-slate-200/70 bg-slate-50/80 px-2 py-2 space-y-2 dark:border-slate-700/50 dark:bg-[hsl(218_10%_10%)]';

/**
 * Superficie blocco scenario: cobalto elegante, bassa saturazione (light + dark).
 */
export const UC_SCENARIO_PANEL_SURFACE =
  'border border-sky-200/70 bg-sky-50/75 px-2 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:border-[hsl(220_14%_34%)] dark:bg-[hsl(220_20%_20%)] dark:shadow-[inset_0_1px_0_rgba(0,0,0,0.18)]';

/**
 * Contenitore editor messaggio parametrico: grigio bluastro, distinto dallo scenario cobalto.
 */
export const UC_PARAMETRIC_EDITOR_SURFACE =
  'rounded-md border border-slate-300/75 bg-slate-100/90 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:border-[hsl(218_10%_28%)] dark:bg-[hsl(218_12%_16%)] dark:shadow-[inset_0_1px_0_rgba(0,0,0,0.22)]';

/** Riquadro scenario in lista wizard / accordion compatto. */
export const UC_WIZARD_SCENARIO_BLOCK = `rounded-md ${UC_SCENARIO_PANEL_SURFACE}`;

/** Zebratura righe lista in wizard: slate / cobalto tenue, coerente con scenario. */
export const UC_LIST_ZEBRA_WIZARD_EVEN =
  'border-slate-200/55 bg-slate-50/90 transition-colors hover:bg-sky-50/80 dark:border-slate-700/35 dark:bg-[hsl(220_12%_14%)] dark:hover:bg-[hsl(220_14%_18%)]';
export const UC_LIST_ZEBRA_WIZARD_ODD =
  'border-slate-200/55 bg-slate-100/70 transition-colors hover:bg-sky-50/75 dark:border-slate-700/32 dark:bg-slate-900/30 dark:hover:bg-[hsl(220_10%_18%)]';

/** Zebratura in vista classica (non wizard): neutra slate/bianco. */
export const UC_LIST_ZEBRA_CLASSIC_EVEN =
  'border-slate-300/60 bg-slate-50 transition-colors hover:bg-violet-100/70 dark:border-slate-600/45 dark:bg-slate-900/35 dark:hover:bg-slate-700/50';
export const UC_LIST_ZEBRA_CLASSIC_ODD =
  'border-slate-300/60 bg-white transition-colors hover:bg-violet-100/70 dark:border-slate-600/45 dark:bg-slate-800/40 dark:hover:bg-slate-700/50';

export const UC_PILL_SCENARIO =
  'inline-flex shrink-0 select-none items-center rounded-full border border-sky-600/40 bg-[hsl(222_28%_16%)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-100 dark:border-sky-500/35 dark:bg-[hsl(220_22%_18%)] dark:text-sky-100/95';
export const UC_PILL_AGENT_MSG =
  'inline-flex shrink-0 select-none items-center rounded-full border border-emerald-600/50 bg-emerald-950/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100';
/** Corpo scenario: ~1px sotto `text-sm` del messaggio agente (textarea classica). */
export const UC_SCENARIO_BODY_TEXT = 'text-[13px] leading-snug';
export const UC_CLASSIC_TEXTAREA_SCENARIO =
  `min-w-0 flex-1 rounded-md border border-sky-600/45 bg-slate-900/95 px-2 py-1.5 ${UC_SCENARIO_BODY_TEXT} text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/45 disabled:opacity-60`;
export const UC_CLASSIC_TEXTAREA_AGENT =
  'min-w-0 flex-1 rounded-md border border-emerald-500/50 bg-emerald-950/50 px-2 py-1.5 font-mono text-sm leading-snug text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-emerald-300/45 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60';

export const UC_SCENARIO_ROW_EDIT_BTN =
  'shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:text-sky-300 group-hover/payoff-row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 disabled:opacity-40';
export const UC_AGENT_ROW_EDIT_BTN =
  'shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:text-violet-300 group-hover/agentmsg-row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40';

export const UC_HEAD_VOTE_BTN =
  'shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-slate-200/90 dark:hover:bg-slate-800/80 group-hover/uc-head:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 disabled:opacity-40';
export const UC_SCENARIO_VOTE_BTN =
  'shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-slate-200/90 dark:hover:bg-slate-800/80 group-hover/payoff-row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 disabled:opacity-40';
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
 *  - `undefined` → neutro slate/cobalto tenue su selezione, hover slate.
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
      ? 'bg-[hsl(158_20%_84%)] hover:bg-[hsl(158_22%_80%)] dark:bg-[hsl(158_16%_26%)] dark:hover:bg-[hsl(158_18%_30%)]'
      : 'bg-[hsl(158_18%_90%)] hover:bg-[hsl(158_20%_86%)] dark:bg-[hsl(158_14%_22%)] dark:hover:bg-[hsl(158_16%_26%)]';
  }
  if (vote === 'down') {
    return active
      ? 'bg-[hsl(2_18%_86%)] hover:bg-[hsl(2_20%_82%)] dark:bg-[hsl(2_16%_28%)] dark:hover:bg-[hsl(2_18%_32%)]'
      : 'bg-[hsl(2_16%_91%)] hover:bg-[hsl(2_18%_87%)] dark:bg-[hsl(2_14%_24%)] dark:hover:bg-[hsl(2_16%_28%)]';
  }
  return active
    ? 'bg-slate-200/90 dark:bg-[hsl(220_14%_22%)]'
    : 'hover:bg-slate-200/90 dark:hover:bg-slate-800/80';
}
