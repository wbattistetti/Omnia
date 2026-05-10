/**
 * Global style presets for debugger use case generation.
 */

export const USE_CASE_GLOBAL_STYLES = [
  {
    id: 'cortese',
    label: 'Cortese',
    contract: 'Rispondi con tono cortese, rassicurante e collaborativo; chiarezza alta, nessuna aggressivita.',
  },
  {
    id: 'ironico',
    label: 'Ironico',
    contract: 'Rispondi con ironia leggera e intelligente, sempre rispettosa e utile; mai sarcasmo offensivo.',
  },
  {
    id: 'formale',
    label: 'Formale',
    contract: 'Rispondi con registro formale, lessico preciso, frasi concise e orientate al contesto professionale.',
  },
] as const;

export type UseCaseGlobalStyleId = (typeof USE_CASE_GLOBAL_STYLES)[number]['id'];

export const DEFAULT_USE_CASE_GLOBAL_STYLE_ID: UseCaseGlobalStyleId = 'cortese';

