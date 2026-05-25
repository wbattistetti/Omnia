/**
 * Task design text observation review: compare agent baseline vs designer draft, clarify, finalize.
 */

const { extractJsonString } = require('./AIAgentDesignService');
const {
  REVIEW_OBSERVATIONS_SYSTEM,
  CLARIFY_OBSERVATION_SYSTEM,
  FINALIZE_SYSTEM,
} = require('./agentTaskTextAnalysisPrompts');

const TIMEOUT_MS = Number.parseInt(process.env.KB_ANALYSIS_TIMEOUT_MS || '120000', 10);
const MAX_MD = 120_000;
const PRESENTATIONS = new Set(['domanda', 'osservazione']);
const KINDS = new Set(['aggiunta', 'correzione', 'contestazione', 'precisazione']);

async function callJsonAnalysis({
  systemPrompt,
  userContent,
  provider,
  model,
  aiProviderService,
  purpose,
  taskId,
  taskLabel,
  validate,
}) {
  const response = await aiProviderService.callAI(
    provider,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    {
      model: model || undefined,
      temperature: 0.25,
      maxTokens: 8192,
      timeout: TIMEOUT_MS,
      purpose,
      taskId,
      taskLabel,
    }
  );
  const content = response?.choices?.[0]?.message?.content;
  const parsed = JSON.parse(extractJsonString(content));
  return validate(parsed);
}

function inferPresentation(kind, text) {
  const t = String(text || '').trim();
  if (kind === 'aggiunta' && /[?？]\s*$/.test(t)) return 'domanda';
  return 'osservazione';
}

function normalizeExcerptForMatch(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function excerptMatchesDraft(excerpt, draft) {
  const e = normalizeExcerptForMatch(excerpt);
  const d = normalizeExcerptForMatch(draft);
  if (!e || !d) return false;
  if (d.includes(e)) return true;
  if (e.length > 48) {
    const prefix = e.slice(0, Math.min(80, Math.floor(e.length * 0.6)));
    if (prefix.length >= 24 && d.includes(prefix)) return true;
  }
  return false;
}

function sanitizeTextExcerptField(excerpt, draft) {
  const t = String(excerpt || '').trim();
  if (!t || !draft?.trim() || !excerptMatchesDraft(t, draft)) return undefined;
  return t.slice(0, 2000);
}

function parseObservationRow(row, idx, draft) {
  const id = typeof row?.id === 'string' && row.id.trim() ? row.id.trim() : String.fromCharCode(65 + idx);
  const kind = String(row?.kind || '').trim();
  const text = typeof row?.text === 'string' ? row.text.trim() : '';
  const interpretation = typeof row?.interpretation === 'string' ? row.interpretation.trim() : '';
  if (!KINDS.has(kind) || !text || !interpretation) {
    throw new Error('Invalid JSON: malformed observation entry');
  }
  const presentationRaw = String(row?.presentation || '').trim();
  const presentation = PRESENTATIONS.has(presentationRaw)
    ? presentationRaw
    : inferPresentation(kind, text);
  const documentExcerpt = sanitizeTextExcerptField(row?.documentExcerpt, draft);
  const excerptRationale =
    documentExcerpt &&
    typeof row?.excerptRationale === 'string' &&
    row.excerptRationale.trim()
      ? row.excerptRationale.trim().slice(0, 500)
      : undefined;
  return {
    id,
    kind,
    presentation,
    text,
    interpretation,
    ...(documentExcerpt ? { documentExcerpt } : {}),
    ...(excerptRationale ? { excerptRationale } : {}),
  };
}

function validateObservationReview(parsed, draft) {
  if (!Array.isArray(parsed.observations) || parsed.observations.length === 0) {
    throw new Error('Invalid JSON: expected non-empty observations array');
  }
  const observations = parsed.observations.map((row, idx) => parseObservationRow(row, idx, draft));
  return { observations };
}

function validateClarifyObservationResponse(parsed, draft) {
  const interpretation = typeof parsed.interpretation === 'string' ? parsed.interpretation.trim() : '';
  if (!interpretation) throw new Error('Invalid JSON: expected non-empty interpretation');
  const documentExcerpt = sanitizeTextExcerptField(parsed.documentExcerpt, draft);
  const excerptRationale =
    documentExcerpt &&
    typeof parsed.excerptRationale === 'string' &&
    parsed.excerptRationale.trim()
      ? parsed.excerptRationale.trim().slice(0, 500)
      : undefined;
  return {
    interpretation,
    ...(documentExcerpt ? { documentExcerpt } : {}),
    ...(excerptRationale ? { excerptRationale } : {}),
  };
}

function validateFinalizeField(parsed) {
  const out = typeof parsed.taskTextMarkdown === 'string' ? parsed.taskTextMarkdown.trim() : '';
  if (!out) throw new Error('Invalid JSON: expected non-empty taskTextMarkdown');
  if (out.length > MAX_MD) throw new Error('Invalid response: taskTextMarkdown exceeds maximum length');
  return { taskTextMarkdown: out };
}

async function reviewTaskTextObservations(params) {
  const baseline = String(params.agentBaselineMarkdown || '').trim();
  const userDraft = String(params.userDraftMarkdown || '').trim();
  if (!baseline) throw new Error('agentBaselineMarkdown is required');
  if (!userDraft) throw new Error('userDraftMarkdown is required');
  if (baseline === userDraft) throw new Error('No diff between agent baseline and user draft');
  const sectionLabel = String(params.sectionLabel || 'task text').trim();
  const parts = [
    `Section: ${sectionLabel}`,
    '',
    '--- Agent last version ---',
    baseline.slice(0, 48_000),
    '',
    '--- Designer edited version ---',
    userDraft.slice(0, 48_000),
  ];
  const draftForValidate = userDraft;
  return callJsonAnalysis({
    systemPrompt: REVIEW_OBSERVATIONS_SYSTEM,
    userContent: parts.join('\n'),
    provider: params.provider,
    model: params.model,
    aiProviderService: params.aiProviderService,
    purpose: params.purpose,
    taskId: params.taskId,
    taskLabel: params.taskLabel,
    validate: (parsed) => validateObservationReview(parsed, draftForValidate),
  });
}

async function clarifyTaskTextObservation(params) {
  const userCorrection = String(params.userCorrection || '').trim();
  if (!userCorrection) throw new Error('userCorrection is required');
  const userDraft = String(params.userDraftMarkdown || '').trim();
  const parts = [
    `Section: ${String(params.sectionLabel || 'task text').trim()}`,
    '',
    '--- Designer note ---',
    String(params.userText || '').slice(0, 8_000),
    '',
    '--- Previous assistant response ---',
    String(params.previousInterpretation || '').slice(0, 8_000),
    '',
    '--- Designer correction ---',
    userCorrection.slice(0, 4_000),
    '',
    '--- Designer edited task text (reference for excerpts) ---',
    userDraft.slice(0, 24_000),
  ];
  return callJsonAnalysis({
    systemPrompt: CLARIFY_OBSERVATION_SYSTEM,
    userContent: parts.join('\n'),
    provider: params.provider,
    model: params.model,
    aiProviderService: params.aiProviderService,
    purpose: params.purpose,
    taskId: params.taskId,
    taskLabel: params.taskLabel,
    validate: (parsed) => validateClarifyObservationResponse(parsed, userDraft),
  });
}

async function finalizeTaskText(params) {
  const baseline = String(params.agentBaselineMarkdown || '').trim();
  const userDraft = String(params.userDraftMarkdown || '').trim();
  if (!baseline || !userDraft) throw new Error('agentBaselineMarkdown and userDraftMarkdown are required');
  if (!Array.isArray(params.observations) || params.observations.length === 0) {
    throw new Error('observations are required');
  }
  const parts = [
    `Section: ${String(params.sectionLabel || 'task text').trim()}`,
    '',
    '--- Agent baseline ---',
    baseline.slice(0, 32_000),
    '',
    '--- Designer draft ---',
    userDraft.slice(0, 32_000),
    '',
    '--- Confirmed observations ---',
    JSON.stringify(params.observations).slice(0, 16_000),
  ];
  return callJsonAnalysis({
    systemPrompt: FINALIZE_SYSTEM,
    userContent: parts.join('\n'),
    provider: params.provider,
    model: params.model,
    aiProviderService: params.aiProviderService,
    purpose: params.purpose,
    taskId: params.taskId,
    taskLabel: params.taskLabel,
    validate: validateFinalizeField,
  });
}

module.exports = {
  reviewTaskTextObservations,
  clarifyTaskTextObservation,
  finalizeTaskText,
};
