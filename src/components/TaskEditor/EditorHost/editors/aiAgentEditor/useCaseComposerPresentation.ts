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
 * Corpo espanso dell’accordion in wizard: sfondo pieno per contrasto con le righe collassate.
 */
export const UC_WIZARD_CARD_BODY =
  'border-t border-slate-200/80 bg-white px-2.5 py-2.5 space-y-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-slate-600/55 dark:bg-slate-800/95 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

/** Riga lista use case aperta (wizard): sfondo pieno distinto dalle righe chiuse. */
export const UC_WIZARD_ROW_EXPANDED =
  'border-slate-300/80 bg-white shadow-sm dark:border-slate-500/50 dark:bg-slate-800/90 dark:shadow-md dark:shadow-black/20';

/**
 * Superficie blocco scenario: bordo leggero, fondo poco saturo, testo grigio smorzato.
 */
export const UC_SCENARIO_PANEL_SURFACE =
  'border border-slate-200/80 bg-slate-100/35 px-2.5 py-2 dark:border-slate-600/40 dark:bg-slate-800/25';

/**
 * Contenitore editor messaggio parametrico: grigio neutro, distinto dallo scenario.
 */
export const UC_PARAMETRIC_EDITOR_SURFACE =
  'rounded-md border border-slate-300/80 bg-slate-50 px-2 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:border-slate-600/50 dark:bg-slate-900/60 dark:shadow-[inset_0_1px_0_rgba(0,0,0,0.15)]';

/** Colonna numero catalogo (1..N) nella lista use case wizard. */
export const UC_CATALOG_NUMBER_COL = 'mt-0.5 w-8 shrink-0 flex justify-center';

/** Colonna icona fissa (messaggio agente + righe azioni nel response use case). */
export const UC_RESPONSE_ICON_COL =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center [&_svg]:shrink-0';

/** Gap tra bordo destro colonna icona e inizio label/testo (5px). */
export const UC_RESPONSE_LABEL_GAP = 'ml-[5px]';

/** Contenuto riga (testo + toolbar) centrato verticalmente con l’icona. */
export const UC_RESPONSE_ROW_CONTENT =
  'inline-flex min-w-0 flex-1 flex-wrap items-center gap-x-[5px] gap-y-1';

/** Monospace body in wizard list (aligned with response action rows). */
export const UC_WIZARD_BODY_MONO = 'font-mono text-sm leading-snug';

/** Testo messaggio agente in lista wizard: massima leggibilità (nero / bianco dark). */
export const UC_WIZARD_AGENT_MESSAGE_TEXT =
  `${UC_WIZARD_BODY_MONO} text-slate-950 dark:text-slate-50`;

/** Domande di test: stesso corpo del messaggio agente, colore blu chiaro. */
export const UC_WIZARD_TEST_QUESTION_TEXT =
  `${UC_WIZARD_BODY_MONO} text-sky-300 dark:text-sky-200`;

export const UC_TEST_QUESTION_TEXTAREA =
  `min-w-0 flex-1 rounded-md border border-sky-500/45 bg-slate-900/95 px-2 py-1.5 ${UC_WIZARD_BODY_MONO} text-sky-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-sky-400/50 focus:outline-none focus:ring-2 focus:ring-sky-500/45 disabled:opacity-60`;

/** Testo scenario in lista wizard: grigio smorzato (non nero pieno). */
export const UC_WIZARD_SCENARIO_TEXT =
  `${UC_WIZARD_BODY_MONO} text-slate-500/95 dark:text-slate-400/95`;

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
/** Corpo scenario in wizard (mono, leggermente più compatto del messaggio). */
export const UC_SCENARIO_BODY_TEXT = `${UC_WIZARD_BODY_MONO} text-[13px]`;
export const UC_CLASSIC_TEXTAREA_SCENARIO =
  `min-w-0 flex-1 rounded-md border border-sky-600/45 bg-slate-900/95 px-2 py-1.5 ${UC_SCENARIO_BODY_TEXT} text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/45 disabled:opacity-60`;
export const UC_CLASSIC_TEXTAREA_AGENT =
  'min-w-0 flex-1 rounded-md border border-emerald-500/50 bg-emerald-950/50 px-2 py-1.5 font-mono text-sm leading-snug text-emerald-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-emerald-300/45 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60';

export const UC_SCENARIO_ROW_EDIT_BTN =
  'shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:text-sky-300 group-hover/payoff-row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/55 disabled:opacity-40';
export const UC_AGENT_ROW_EDIT_BTN =
  'shrink-0 rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:text-violet-300 group-hover/agentmsg-row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40';

/** Toolbar stile / Magic in modifica messaggio: sempre visibile accanto a ✓ / ✗. */
export const UC_AGENT_STYLE_TOOL_BTN =
  'shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:text-sky-300 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40';

/** Toolbar riga UC: visibilità gestita dal contenitore hover, non da opacity sui bottoni. */
export const UC_HEAD_VOTE_BTN =
  'shrink-0 rounded p-0.5 transition-opacity hover:bg-slate-200/90 dark:hover:bg-slate-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 disabled:opacity-40';
export const UC_SCENARIO_VOTE_BTN =
  'shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-slate-200/90 dark:hover:bg-slate-800/80 group-hover/payoff-row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 disabled:opacity-40';
export const UC_AGENT_VOTE_BTN =
  'shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-slate-200/90 dark:hover:bg-slate-800/80 group-hover/agentmsg-row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 disabled:opacity-40';

export function aiFieldToneClass(current: string, baseline: string | undefined): string {
  if (baseline === undefined) return 'text-slate-500';
  return current === baseline ? 'text-slate-500' : 'text-emerald-400';
}

/** Bordo/sfondo riga wizard quando un campo è «da approfondire». */
export const UC_ROW_REVIEW_EDGE =
  'border-l-[3px] border-l-orange-500/75 bg-orange-50/55 dark:border-l-orange-400/70 dark:bg-orange-950/35';

/** Colore testo: pollice (verde/rosso/arancione) ha priorità su baseline IA. */
export function fieldTextClass(
  vote: 'up' | 'down' | 'review' | undefined,
  current: string,
  baseline: string | undefined
): string {
  if (vote === 'up') return 'text-emerald-700 dark:text-emerald-100';
  if (vote === 'down') return 'text-rose-900 dark:text-rose-100';
  if (vote === 'review') return 'text-orange-800 dark:text-orange-200';
  return aiFieldToneClass(current, baseline);
}

/** Sfondo header accordion wizard: neutro (il voto è sul colore del titolo). */
export function useCaseHeaderShellClass(active: boolean): string {
  const ring = active ? 'ring-1 ring-inset ring-slate-900/10 dark:ring-white/12' : '';
  return active
    ? `bg-slate-200/95 text-slate-800 hover:bg-slate-200 dark:bg-slate-700/90 dark:text-slate-100 dark:hover:bg-slate-700/95 ${ring}`
    : `bg-slate-100/90 text-slate-800 hover:bg-slate-200/95 dark:bg-slate-800/75 dark:text-slate-100 dark:hover:bg-slate-700/80`;
}

/**
 * Attenuazione titolo quando il use case è escluso dalla checkbox «incluso».
 * Solo voto verde (`up`): «spento» operativo. Rosso e da rivedere restano leggibili
 * (il rosso già segnala scarto; l'arancione richiede ancora review).
 */
/**
 * Attenuazione titolo quando il use case è escluso (checkbox off): mantiene la famiglia
 * colore del voto validazione (ambra/arancione/verde/rosso) ma smorzata.
 */
export function useCaseHeaderExcludedDimClass(
  _labelVote: 'up' | 'down' | 'review' | undefined,
  included: boolean
): string {
  if (included) return '';
  return ' opacity-[0.42] saturate-[0.55]';
}

/**
 * Colore titolo header: arancione (da validare), verde (validato), rosso (non validato).
 */
export function useCaseHeaderTitleTextClass(
  labelVote: 'up' | 'down' | 'review' | undefined,
  active: boolean,
  included = true
): string {
  const weight = active ? 'font-semibold' : 'font-medium';
  const dim = useCaseHeaderExcludedDimClass(labelVote, included);
  if (labelVote === 'up') {
    return `${UC_WIZARD_BODY_MONO} ${weight} text-emerald-700 dark:text-emerald-300${dim}`;
  }
  if (labelVote === 'down') {
    return `${UC_WIZARD_BODY_MONO} ${weight} text-rose-700 dark:text-rose-300${dim}`;
  }
  if (labelVote === 'review') {
    return `${UC_WIZARD_BODY_MONO} ${weight} text-orange-700 dark:text-orange-300${dim}`;
  }
  return `${UC_WIZARD_BODY_MONO} ${weight} text-amber-700 dark:text-amber-400${dim}`;
}

/** Contenitore messaggio agente in lista wizard. */
export const UC_WIZARD_AGENT_MESSAGE_PANEL =
  'rounded-md border border-slate-300/85 bg-white px-2.5 py-2 dark:border-slate-500/50 dark:bg-slate-900/65';
