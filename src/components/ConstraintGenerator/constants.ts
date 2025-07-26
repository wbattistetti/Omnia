// Costanti condivise per ConstraintGenerator

import { LanguageKey } from './types';

export const LANGUAGES: { key: LanguageKey; label: string }[] = [
  { key: 'js', label: 'JavaScript' },
  { key: 'py', label: 'Python' },
  { key: 'ts', label: 'TypeScript' },
];

export const DEFAULT_MONACO_HEIGHT = 320;
export const MONACO_MIN_HEIGHT = 140;
export const MONACO_MAX_HEIGHT = 900;

export const PLACEHOLDER_DESCRIPTION = 'Es: Deve essere una data nel passato, Deve essere un numero positivo, ...';
export const PLACEHOLDER_TEST_INPUT = 'Valore di test';
export const PLACEHOLDER_TEST_DESC = 'descrizione…';
export const PLACEHOLDER_AI_LABEL = 'Etichetta sintetica (max 2 parole)';
export const PLACEHOLDER_AI_PAYOFF = 'Descrizione naturale (1-2 righe)';
export const PLACEHOLDER_AI_SUMMARY = 'Sintesi del vincolo generata dalla IA';
export const PLACEHOLDER_AI_TEST_INPUT = 'Valore di test generato';
export const PLACEHOLDER_AI_TEST_DESC = 'Descrizione test generato';
export const PLACEHOLDER_AI_LOADING = 'Sto analizzando…';
export const PLACEHOLDER_AI_CREATING = 'Sto creando il template…';

export const COLOR_VALID = '#22c55e';
export const COLOR_INVALID = '#ef4444';
export const COLOR_MONACO_BORDER = '#a21caf';
export const COLOR_MONACO_BG = '#18181b'; 