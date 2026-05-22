/**
 * Classi Tailwind condivise per i pannelli review (subset del composer Omnia).
 */

export const USE_CASE_PANEL_SHELL =
  'rounded-lg border border-slate-300/80 bg-white/90 text-slate-900 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)] dark:border-slate-600/65 dark:bg-slate-900/40 dark:text-slate-100 dark:shadow-[inset_0_0_0_1px_rgba(148,163,184,0.06)]';

export const UC_USE_CASE_LIST_SCROLL =
  'min-h-0 flex-1 basis-0 overflow-y-scroll overflow-x-hidden overscroll-contain pr-0.5 [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.75)_rgba(15,23,42,0.92)] dark:[scrollbar-color:rgba(148,163,184,0.85)_rgba(15,23,42,0.95)] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/75 [&::-webkit-scrollbar-thumb]:hover:bg-slate-400/85 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-900/80';

export const UC_WIZARD_CARD_BODY =
  'border-t border-slate-200/80 bg-white px-2.5 py-2.5 space-y-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-slate-600/55 dark:bg-slate-800/95 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

export const UC_WIZARD_ROW_EXPANDED =
  'border-slate-300/80 bg-white shadow-sm dark:border-slate-500/50 dark:bg-slate-800/90 dark:shadow-md dark:shadow-black/20';

export const UC_SCENARIO_PANEL_SURFACE =
  'border border-slate-200/80 bg-slate-100/35 px-2.5 py-2 dark:border-slate-600/40 dark:bg-slate-800/25';

export const UC_WIZARD_SCENARIO_BLOCK = `rounded-md ${UC_SCENARIO_PANEL_SURFACE}`;

export const UC_WIZARD_AGENT_MESSAGE_PANEL = 'space-y-1';

export const UC_CLASSIC_TEXTAREA_SCENARIO =
  'min-w-0 flex-1 rounded-md border border-sky-600/45 bg-slate-900/95 px-2 py-1.5 font-mono text-[13px] leading-snug text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/45 disabled:opacity-60';

export const UC_RESPONSE_ICON_COL =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center [&_svg]:shrink-0';
