/**
 * KB document analysis: propose, refine, observation review, clarify, finalize.
 */

const { extractJsonString } = require('./AIAgentDesignService');
const kbDocumentRepository = require('./kbDocumentRepository');
const {
  PROPOSE_SYSTEM,
  REFINE_SYSTEM,
  REVIEW_OBSERVATIONS_SYSTEM,
  CLARIFY_OBSERVATION_SYSTEM,
  FINALIZE_SYSTEM,
} = require('./kbDocumentAnalysisPrompts');

const TIMEOUT_MS = Number.parseInt(process.env.KB_ANALYSIS_TIMEOUT_MS || '120000', 10);
const MAX_MD = 120_000;
const PRESENTATIONS = new Set(['domanda', 'osservazione']);
const KINDS = new Set(['aggiunta', 'correzione', 'contestazione', 'precisazione']);

function appendTaskContext(parts, { agentTaskSummary, taskVariables, existingUseCaseSummaries }) {
  const summary = String(agentTaskSummary || '').trim();
  if (summary) parts.push('', '--- Agent task context ---', summary.slice(0, 8_000));
  if (Array.isArray(taskVariables) && taskVariables.length > 0) {
    parts.push('', '--- Task variables ---', JSON.stringify(taskVariables).slice(0, 4_000));
  }
  if (Array.isArray(existingUseCaseSummaries) && existingUseCaseSummaries.length > 0) {
    parts.push(
      '',
      '--- Existing use cases (context) ---',
      existingUseCaseSummaries.join('\n').slice(0, 4_000)
    );
  }
}

function loadDocumentSample(projectId, repositoryDocumentId, sampleOverride) {
  const override = String(sampleOverride || '').trim();
  if (override) return override;
  const pid = String(projectId || '').trim();
  const rid = String(repositoryDocumentId || '').trim();
  if (!pid || !rid) return '';
  try {
    const hit = kbDocumentRepository.readDocumentText(pid, rid, { maxChars: 24_000 });
    return typeof hit?.text === 'string' ? hit.text : '';
  } catch {
    return '';
  }
}

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

function validateMarkdownField(parsed, field = 'documentAnalysisMarkdown') {
  const out = typeof parsed[field] === 'string' ? parsed[field].trim() : '';
  if (!out) throw new Error(`Invalid JSON: expected non-empty ${field}`);
  if (out.length > MAX_MD) throw new Error(`Invalid response: ${field} exceeds maximum length`);
  return { documentAnalysisMarkdown: out };
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

function documentExcerptMatchesSample(excerpt, sample) {
  const e = normalizeExcerptForMatch(excerpt);
  const s = normalizeExcerptForMatch(sample);
  if (!e || !s) return false;
  if (s.includes(e)) return true;
  if (e.length > 48) {
    const prefix = e.slice(0, Math.min(80, Math.floor(e.length * 0.6)));
    if (prefix.length >= 24 && s.includes(prefix)) return true;
  }
  return false;
}

function sanitizeDocumentExcerptField(excerpt, sample) {
  const t = String(excerpt || '').trim();
  if (!t || !sample?.trim() || !documentExcerptMatchesSample(t, sample)) return undefined;
  return t.slice(0, 2000);
}

function parseObservationRow(row, idx, sample) {
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
  const documentExcerpt = sanitizeDocumentExcerptField(row?.documentExcerpt, sample);
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

function validateObservationReview(parsed, sample) {
  if (!Array.isArray(parsed.observations) || parsed.observations.length === 0) {
    throw new Error('Invalid JSON: expected non-empty observations array');
  }
  const observations = parsed.observations.map((row, idx) => parseObservationRow(row, idx, sample));
  return { observations };
}

function validateClarifyObservationResponse(parsed, sample) {
  const interpretation = typeof parsed.interpretation === 'string' ? parsed.interpretation.trim() : '';
  if (!interpretation) throw new Error('Invalid JSON: expected non-empty interpretation');
  const documentExcerpt = sanitizeDocumentExcerptField(parsed.documentExcerpt, sample);
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

async function proposeDocumentAnalysis(params) {
  const sample = loadDocumentSample(params.projectId, params.repositoryDocumentId, params.documentSampleText);
  if (!sample.trim()) {
    throw new Error('Document sample is empty — cannot propose analysis');
  }
  const parts = [`Document name: ${params.documentName || 'document'}`, '', '--- Document sample ---', sample.slice(0, 24_000)];
  appendTaskContext(parts, params);
  return callJsonAnalysis({
    systemPrompt: PROPOSE_SYSTEM,
    userContent: parts.join('\n'),
    provider: params.provider,
    model: params.model,
    aiProviderService: params.aiProviderService,
    purpose: params.purpose,
    taskId: params.taskId,
    taskLabel: params.taskLabel,
    validate: validateMarkdownField,
  });
}

async function refineDocumentAnalysis(params) {
  const draft = String(params.draftMarkdown || '').trim();
  if (!draft) throw new Error('draftMarkdown is required');
  const sample = loadDocumentSample(params.projectId, params.repositoryDocumentId, params.documentSampleText);
  const parts = [
    `Document name: ${params.documentName || 'document'}`,
    '',
    '--- User draft (refine this) ---',
    draft.slice(0, 48_000),
  ];
  if (sample.trim()) parts.push('', '--- Document sample (reference only) ---', sample.slice(0, 24_000));
  appendTaskContext(parts, params);
  return callJsonAnalysis({
    systemPrompt: REFINE_SYSTEM,
    userContent: parts.join('\n'),
    provider: params.provider,
    model: params.model,
    aiProviderService: params.aiProviderService,
    purpose: params.purpose,
    taskId: params.taskId,
    taskLabel: params.taskLabel,
    validate: validateMarkdownField,
  });
}

async function reviewAnalysisObservations(params) {
  const baseline = String(params.agentBaselineMarkdown || '').trim();
  const userDraft = String(params.userDraftMarkdown || '').trim();
  if (!baseline) throw new Error('agentBaselineMarkdown is required');
  if (!userDraft) throw new Error('userDraftMarkdown is required');
  if (baseline === userDraft) throw new Error('No diff between agent baseline and user draft');
  const parts = [
    `Document name: ${params.documentName || 'document'}`,
    '',
    '--- Agent last version ---',
    baseline.slice(0, 48_000),
    '',
    '--- User edited version ---',
    userDraft.slice(0, 48_000),
  ];
  const sample = loadDocumentSample(params.projectId, params.repositoryDocumentId, params.documentSampleText);
  if (sample.trim()) parts.push('', '--- Document sample (reference only) ---', sample.slice(0, 12_000));
  const sampleForValidate = sample.trim();
  return callJsonAnalysis({
    systemPrompt: REVIEW_OBSERVATIONS_SYSTEM,
    userContent: parts.join('\n'),
    provider: params.provider,
    model: params.model,
    aiProviderService: params.aiProviderService,
    purpose: params.purpose,
    taskId: params.taskId,
    taskLabel: params.taskLabel,
    validate: (parsed) => validateObservationReview(parsed, sampleForValidate),
  });
}

async function clarifyObservationResponse(params) {
  const userCorrection = String(params.userCorrection || '').trim();
  if (!userCorrection) throw new Error('userCorrection is required');
  const sample = loadDocumentSample(params.projectId, params.repositoryDocumentId, params.documentSampleText);
  const parts = [
    `Document name: ${params.documentName || 'document'}`,
    '',
    '--- User observation ---',
    String(params.userText || '').slice(0, 8_000),
    '',
    '--- Previous agent response ---',
    String(params.previousInterpretation || '').slice(0, 8_000),
    '',
    '--- User correction ---',
    userCorrection.slice(0, 4_000),
  ];
  if (sample.trim()) parts.push('', '--- Document sample (reference only) ---', sample.slice(0, 12_000));
  const sampleForValidate = sample.trim();
  return callJsonAnalysis({
    systemPrompt: CLARIFY_OBSERVATION_SYSTEM,
    userContent: parts.join('\n'),
    provider: params.provider,
    model: params.model,
    aiProviderService: params.aiProviderService,
    purpose: params.purpose,
    taskId: params.taskId,
    taskLabel: params.taskLabel,
    validate: (parsed) => validateClarifyObservationResponse(parsed, sampleForValidate),
  });
}

async function finalizeDocumentAnalysis(params) {
  const baseline = String(params.agentBaselineMarkdown || '').trim();
  const userDraft = String(params.userDraftMarkdown || '').trim();
  if (!baseline || !userDraft) throw new Error('agentBaselineMarkdown and userDraftMarkdown are required');
  if (!Array.isArray(params.observations) || params.observations.length === 0) {
    throw new Error('observations are required');
  }
  const parts = [
    `Document name: ${params.documentName || 'document'}`,
    '',
    '--- Agent baseline ---',
    baseline.slice(0, 32_000),
    '',
    '--- User draft ---',
    userDraft.slice(0, 32_000),
    '',
    '--- Confirmed observations ---',
    JSON.stringify(params.observations).slice(0, 16_000),
  ];
  const sample = loadDocumentSample(params.projectId, params.repositoryDocumentId, params.documentSampleText);
  if (sample.trim()) parts.push('', '--- Document sample (reference only) ---', sample.slice(0, 12_000));
  appendTaskContext(parts, params);
  return callJsonAnalysis({
    systemPrompt: FINALIZE_SYSTEM,
    userContent: parts.join('\n'),
    provider: params.provider,
    model: params.model,
    aiProviderService: params.aiProviderService,
    purpose: params.purpose,
    taskId: params.taskId,
    taskLabel: params.taskLabel,
    validate: validateMarkdownField,
  });
}

module.exports = {
  proposeDocumentAnalysis,
  refineDocumentAnalysis,
  reviewAnalysisObservations,
  clarifyObservationResponse,
  finalizeDocumentAnalysis,
};
