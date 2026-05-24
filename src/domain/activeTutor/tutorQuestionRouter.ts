/**
 * Active Tutor — routing keyword delle domande libere verso la tab corretta.
 */

import type { TutorPhaseKey } from './tutorPhaseKey';

export interface QuestionRouteResult {
  readonly detectedPhase: TutorPhaseKey;
  readonly belongsToActivePhase: boolean;
}

interface PhaseKeywordRule {
  readonly phase: TutorPhaseKey;
  readonly keywords: readonly string[];
}

/** Ordine: fasi più specifiche prima. */
const PHASE_KEYWORD_RULES: readonly PhaseKeywordRule[] = [
  {
    phase: 'errorHandling',
    keywords: [
      'error handling',
      'error-handling',
      'regola conversazionale',
      'regole conversazionali',
      'conversational rule',
      'fallback',
      'escalation',
      'handoff',
      'trasferimento operatore',
    ],
  },
  {
    phase: 'knowledgeBase',
    keywords: [
      'knowledge base',
      'knowledge-base',
      'documento',
      'documenti',
      'kb ',
      ' analisi documento',
      'markdown documento',
      'carica file',
      'xlsx',
      '.txt',
    ],
  },
  {
    phase: 'backend',
    keywords: [
      'backend',
      'api',
      'chiamat',
      'endpoint',
      'rest',
      'webhook',
      'send',
      'receive',
      'errore api',
      'catalogo backend',
      'recupera specifiche',
      'test api',
      'openapi',
    ],
  },
  {
    phase: 'prompts',
    keywords: [
      'use case',
      'usecase',
      'conversazion',
      'token',
      'tokenizz',
      'scenario',
      'stile convers',
      'dialogo',
      'messagg',
      'bundle',
      'prompts',
      'slot mapping',
      'json conversazionale',
    ],
  },
  {
    phase: 'dati',
    keywords: [
      'schema',
      'campo',
      'struttur',
      'variabil',
      'slot',
      'dati',
      'proposed field',
      'output mapping',
      'inferit',
    ],
  },
  {
    phase: 'voce',
    keywords: [
      'voce',
      'vocal',
      'prosod',
      'tts',
      'elevenlabs',
      'parlare',
      'audio',
      'sintesi vocale',
    ],
  },
  {
    phase: 'task',
    keywords: [
      'task',
      'obiettiv',
      'dominio',
      'limit',
      'tono',
      'descrizion',
      'agente',
      'comportament',
      'personalit',
      'create agent',
      'refine',
      'sezione strutturata',
    ],
  },
];

function normalizeQuestion(q: string): string {
  return q.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function scorePhase(normalized: string, rule: PhaseKeywordRule): number {
  let score = 0;
  for (const kw of rule.keywords) {
    if (normalized.includes(kw)) score += 1;
  }
  return score;
}

/**
 * Classifica la domanda verso la fase più probabile.
 * In caso di parità o nessun match → fase attiva.
 */
export function routeTutorQuestion(
  question: string,
  activePhaseKey: TutorPhaseKey
): QuestionRouteResult {
  const normalized = normalizeQuestion(question.trim());
  if (!normalized) {
    return { detectedPhase: activePhaseKey, belongsToActivePhase: true };
  }

  let bestPhase = activePhaseKey;
  let bestScore = 0;

  for (const rule of PHASE_KEYWORD_RULES) {
    const s = scorePhase(normalized, rule);
    if (s > bestScore) {
      bestScore = s;
      bestPhase = rule.phase;
    }
  }

  if (bestScore === 0) {
    return { detectedPhase: activePhaseKey, belongsToActivePhase: true };
  }

  return {
    detectedPhase: bestPhase,
    belongsToActivePhase: bestPhase === activePhaseKey,
  };
}
