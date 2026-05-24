/**
 * Active Tutor — risolve elemento UI da evidenziare dopo una domanda libera (keyword → UI_IDS).
 */

import type { TutorPhaseKey } from './tutorPhaseKey';
import { UI_IDS } from './tutorUiIds';
import { mainUiIdForPhase } from './tutorPhaseAttention';
import { routeTutorQuestion } from './tutorQuestionRouter';
import type { TutorEnsureViewId } from './tutorEnsureView';

export type TutorAttentionEffectType = 'blink' | 'pulse' | 'highlight' | 'glow';

export interface TutorQuestionAttentionTarget {
  readonly elementId: string;
  readonly type: TutorAttentionEffectType;
  readonly phaseKey: TutorPhaseKey;
  readonly ensureView?: TutorEnsureViewId;
}

interface AttentionKeywordRule {
  readonly keywords: readonly string[];
  readonly elementId: string;
  readonly type: TutorAttentionEffectType;
  readonly phaseKey: TutorPhaseKey;
  readonly ensureView?: TutorEnsureViewId;
}

/** Regole ordinate per specificità (match più specifico vince a parità di score). */
const ATTENTION_KEYWORD_RULES: readonly AttentionKeywordRule[] = [
  {
    keywords: ['conferma fase', 'confermo', 'conferma task', 'conferma prompts', 'conferma backend'],
    elementId: UI_IDS.confirmTaskButton,
    type: 'pulse',
    phaseKey: 'task',
  },
  {
    keywords: ['create agent', 'crea agente', 'create agente'],
    elementId: UI_IDS.createAgentButton,
    type: 'blink',
    phaseKey: 'task',
  },
  {
    keywords: ['refine', 'raffina comportament'],
    elementId: UI_IDS.createAgentButton,
    type: 'pulse',
    phaseKey: 'task',
  },
  {
    keywords: ['descrizion', 'textarea', 'campo task', 'cosa scrivo', 'testo libero'],
    elementId: UI_IDS.taskDescriptionInput,
    type: 'glow',
    phaseKey: 'task',
  },
  {
    keywords: ['scopo', 'sequenza', 'vincoli', 'sezion struttur', 'tab struttur', 'prompt finale'],
    elementId: UI_IDS.taskFormattedBox,
    type: 'highlight',
    phaseKey: 'task',
  },
  {
    keywords: ['test api', 'testapi', 'prova api', 'prova chiamata'],
    elementId: UI_IDS.backendList,
    type: 'blink',
    phaseKey: 'backend',
    ensureView: 'backendMain',
  },
  {
    keywords: ['recupera specifiche', 'openapi', 'send', 'receive', 'interpreta'],
    elementId: UI_IDS.backendList,
    type: 'pulse',
    phaseKey: 'backend',
    ensureView: 'backendMain',
  },
  {
    keywords: ['add backend', 'aggiungi backend', 'emula backend', 'create backend specs'],
    elementId: UI_IDS.backendList,
    type: 'glow',
    phaseKey: 'backend',
    ensureView: 'backendMain',
  },
  {
    keywords: ['analisi documento', 'analizza documento', 'analisi del documento'],
    elementId: UI_IDS.kbAnalysisResult,
    type: 'blink',
    phaseKey: 'backend',
    ensureView: 'knowledgeBase',
  },
  {
    keywords: [
      'knowledge base',
      'documenti',
      'caricare document',
      'carico document',
      'pdf',
      'xlsx',
      'kb ',
    ],
    elementId: UI_IDS.kbDocumentList,
    type: 'glow',
    phaseKey: 'backend',
    ensureView: 'knowledgeBase',
  },
  {
    keywords: ['interface', 'interfaccia agente', 'input output', 'contratto input'],
    elementId: UI_IDS.interfacePanel,
    type: 'glow',
    phaseKey: 'backend',
    ensureView: 'interface',
  },
  {
    keywords: ['genera use case', 'use case', 'usecase', 'casi d uso', 'scenario'],
    elementId: UI_IDS.promptsMainEditor,
    type: 'glow',
    phaseKey: 'prompts',
  },
  {
    keywords: ['conversazion', 'dialogo', 'dialoghi', 'bubble'],
    elementId: UI_IDS.promptsMainEditor,
    type: 'glow',
    phaseKey: 'prompts',
  },
  {
    keywords: ['token', 'tokenizz', 'prompt e json', 'json deriv', 'semantic token', 'style token'],
    elementId: UI_IDS.promptsMainEditor,
    type: 'highlight',
    phaseKey: 'prompts',
  },
  {
    keywords: ['error handling', 'gestione errori', 'errori convers'],
    elementId: UI_IDS.promptsMainEditor,
    type: 'pulse',
    phaseKey: 'prompts',
  },
  {
    keywords: ['slot', 'schema dati', 'campo dati', 'proposed field', 'tabella dati', 'variabil'],
    elementId: UI_IDS.datiEditor,
    type: 'highlight',
    phaseKey: 'dati',
  },
  {
    keywords: ['salva', 'tts', 'elevenlabs', 'convai', 'scegli voce', 'agent setup'],
    elementId: UI_IDS.voceEditor,
    type: 'glow',
    phaseKey: 'voce',
  },
  {
    keywords: ['voce', 'vocal', 'parlare', 'sintesi vocale'],
    elementId: UI_IDS.voceEditor,
    type: 'glow',
    phaseKey: 'voce',
  },
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function scoreRule(normalized: string, rule: AttentionKeywordRule): number {
  let score = 0;
  for (const kw of rule.keywords) {
    if (normalized.includes(kw)) score += 1;
  }
  return score;
}

/**
 * Determina quale elemento UI evidenziare in base alla domanda (e fase attiva).
 * Fallback: elemento principale della fase rilevata dal router.
 */
export function resolveTutorQuestionAttention(
  question: string,
  activePhaseKey: TutorPhaseKey
): TutorQuestionAttentionTarget {
  const normalized = normalizeText(question.trim());
  const route = routeTutorQuestion(question, activePhaseKey);
  const fallbackPhase = route.detectedPhase;

  if (!normalized) {
    return {
      elementId: mainUiIdForPhase(fallbackPhase),
      type: 'glow',
      phaseKey: fallbackPhase,
    };
  }

  let bestRule: AttentionKeywordRule | null = null;
  let bestScore = 0;

  for (const rule of ATTENTION_KEYWORD_RULES) {
    const s = scoreRule(normalized, rule);
    if (s > bestScore) {
      bestScore = s;
      bestRule = rule;
    }
  }

  if (bestRule && bestScore > 0) {
    return {
      elementId: bestRule.elementId,
      type: bestRule.type,
      phaseKey: bestRule.phaseKey,
      ensureView: bestRule.ensureView,
    };
  }

  return {
    elementId: mainUiIdForPhase(fallbackPhase),
    type: 'glow',
    phaseKey: fallbackPhase,
  };
}
