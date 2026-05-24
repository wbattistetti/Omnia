/**
 * Active Tutor — compone il manuale completo per sync backend + test dominio.
 */

import { MANUAL_WIZARD_INTRO, MANUAL_TUTOR_FAQ } from './manualWizardIntro';
import { MANUAL_OVERVIEW } from './manualOverview';
import { MANUAL_GLOSSARY } from './manualGlossary';
import { MANUAL_TASK } from './manualTask';
import { MANUAL_KNOWLEDGE_BASE } from './manualKnowledgeBase';
import { MANUAL_BACKEND } from './manualBackend';
import { MANUAL_PROMPTS } from './manualPrompts';
import { MANUAL_ERROR_HANDLING } from './manualErrorHandling';
import { MANUAL_DATI } from './manualDati';
import { MANUAL_VOCE } from './manualVoce';
import { MANUAL_TUTOR_QA } from './manualTutorQA';

export const DESIGNER_MANUAL_FOR_TUTOR = [
  MANUAL_WIZARD_INTRO,
  MANUAL_OVERVIEW,
  MANUAL_GLOSSARY,
  MANUAL_TASK,
  MANUAL_KNOWLEDGE_BASE,
  MANUAL_BACKEND,
  MANUAL_PROMPTS,
  MANUAL_ERROR_HANDLING,
  MANUAL_DATI,
  MANUAL_VOCE,
  MANUAL_TUTOR_QA,
  MANUAL_TUTOR_FAQ,
]
  .map((s) => s.trim())
  .join('\n\n');

export const DESIGNER_MANUAL_MARKDOWN = DESIGNER_MANUAL_FOR_TUTOR;

export const TUTOR_MANUAL_TO_WIZARD_HINT = `
Wizard Omnia (7 step): 0 Task, 1 Knowledge Base, 2 Backend (+ toggle Interface), 3 Prompts, 4 Error Handling, 5 Dati, 6 Voce.
Test API = editor singola Backend Call. Recupera specifiche = Read OpenAPI (NON "Interpreta I/O").
Conferma fase = pannello Tutor «Conferma fase …».
`;
