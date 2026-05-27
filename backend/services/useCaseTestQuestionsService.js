/**
 * Generazione domande di test per singolo use case (design-time QA).
 */

const { extractJsonString } = require('./AIAgentDesignService');
const { GENERATE_TEST_QUESTIONS_SYSTEM } = require('./useCaseTestQuestionsPrompts');

const TIMEOUT_MS = Number.parseInt(process.env.USE_CASE_TEST_QUESTIONS_TIMEOUT_MS || '90000', 10);
const MAX_QUESTIONS = 12;
const MAX_TEXT = 500;
const MAX_ANSWER = 1200;

function normalizeForDedup(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function compactUseCaseForPrompt(useCase) {
  if (!useCase || typeof useCase !== 'object') return {};
  const uc = useCase;
  const scenario =
    uc.scenario && typeof uc.scenario === 'object'
      ? {
          llm: typeof uc.scenario.llm === 'string' ? uc.scenario.llm.slice(0, 2000) : '',
        }
      : { llm: typeof uc.payoff === 'string' ? uc.payoff.slice(0, 2000) : '' };
  const dialogue = Array.isArray(uc.dialogue)
    ? uc.dialogue.map((t) => ({
        role: t?.role === 'user' ? 'user' : 'assistant',
        content: typeof t?.content === 'string' ? t.content.slice(0, 800) : '',
      }))
    : [];
  const phrases = Array.isArray(uc.phrases)
    ? uc.phrases.slice(0, 3).map((p) => ({
        naturalText: typeof p?.naturalText === 'string' ? p.naturalText.slice(0, 400) : '',
      }))
    : [];
  return {
    id: typeof uc.id === 'string' ? uc.id : '',
    label: typeof uc.label === 'string' ? uc.label.slice(0, 120) : '',
    scenario,
    payoff: typeof uc.payoff === 'string' ? uc.payoff.slice(0, 2000) : '',
    dialogue,
    notes: uc.notes && typeof uc.notes === 'object' ? uc.notes : {},
    phrases,
  };
}

function validateGenerateResponse(parsed, existingTexts) {
  if (!Array.isArray(parsed.test_questions)) {
    throw new Error('Invalid JSON: expected test_questions array');
  }
  const seen = new Set(existingTexts.map(normalizeForDedup));
  const out = [];
  for (const row of parsed.test_questions) {
    if (!row || typeof row !== 'object') continue;
    const text = typeof row.text === 'string' ? row.text.trim() : '';
    if (!text || text.length > MAX_TEXT) continue;
    const key = normalizeForDedup(text);
    if (seen.has(key)) continue;
    seen.add(key);
    const expectedAnswer =
      typeof row.expectedAnswer === 'string' ? row.expectedAnswer.trim().slice(0, MAX_ANSWER) : '';
    const kindRaw = String(row.kind || '').trim();
    const kind = ['direct', 'colloquial', 'abbreviated', 'ambiguous'].includes(kindRaw)
      ? kindRaw
      : 'direct';
    out.push({ text, expectedAnswer, kind });
    if (out.length >= MAX_QUESTIONS) break;
  }
  if (out.length === 0) {
    throw new Error('No novel test questions generated (all duplicates or empty)');
  }
  return { test_questions: out };
}

async function generateUseCaseTestQuestions(params) {
  const useCase = params.useCase;
  if (!useCase || typeof useCase !== 'object') {
    throw new Error('useCase is required');
  }
  const existing = Array.isArray(params.existingTestQuestions) ? params.existingTestQuestions : [];
  const existingTexts = existing
    .map((q) => (q && typeof q.text === 'string' ? q.text : ''))
    .filter(Boolean);
  const lang =
    typeof params.outputLanguage === 'string' && params.outputLanguage.trim()
      ? `\nOUTPUT_LANGUAGE (BCP 47): ${params.outputLanguage.trim()}\n`
      : '';
  const parts = [
    lang,
    'USE_CASE:',
    JSON.stringify(compactUseCaseForPrompt(useCase)),
    '',
    'EXISTING_TEST_QUESTIONS (do not repeat):',
    JSON.stringify(existingTexts.slice(0, 40)),
    '',
    'Generate novel test questions only.',
  ];
  const response = await params.aiProviderService.callAI(
    params.provider,
    [
      { role: 'system', content: GENERATE_TEST_QUESTIONS_SYSTEM },
      { role: 'user', content: parts.join('\n') },
    ],
    {
      model: params.model || undefined,
      temperature: 0.45,
      maxTokens: 4096,
      timeout: TIMEOUT_MS,
      purpose: params.purpose || 'USE_CASE_GENERATE_TEST_QUESTIONS',
      taskId: params.taskId,
      taskLabel: params.taskLabel,
    }
  );
  const content = response?.choices?.[0]?.message?.content;
  const parsed = JSON.parse(extractJsonString(content));
  return validateGenerateResponse(parsed, existingTexts);
}

module.exports = { generateUseCaseTestQuestions };
