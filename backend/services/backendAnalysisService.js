/**
 * Backend usage analysis: propose, refine, observation review, clarify, finalize.
 */

const { extractJsonString } = require('./AIAgentDesignService');
const {
  PROPOSE_SYSTEM,
  REFINE_SYSTEM,
  REVIEW_OBSERVATIONS_SYSTEM,
  CLARIFY_OBSERVATION_SYSTEM,
  FINALIZE_SYSTEM,
  CREATE_SUGGESTED_FEATURE_SYSTEM,
} = require('./backendAnalysisPrompts');
const { BACKEND_DISTILL_RUNTIME_SYSTEM } = require('./analysisRuntimeDistillPrompts');

const TIMEOUT_MS = Number.parseInt(process.env.KB_ANALYSIS_TIMEOUT_MS || '120000', 10);
const MAX_MD = 120_000;
const MAX_RUNTIME_DISTILL = 4_000;
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

function validateMarkdownField(parsed, field = 'backendAnalysisMarkdown') {
  const out = typeof parsed[field] === 'string' ? parsed[field].trim() : '';
  if (!out) throw new Error(`Invalid JSON: expected non-empty ${field}`);
  if (out.length > MAX_MD) throw new Error(`Invalid response: ${field} exceeds maximum length`);
  return { backendAnalysisMarkdown: out };
}

function validateRuntimeDistillField(parsed) {
  const out =
    typeof parsed.runtimeDistilledMarkdown === 'string'
      ? parsed.runtimeDistilledMarkdown.trim()
      : '';
  if (!out) throw new Error('Invalid JSON: expected non-empty runtimeDistilledMarkdown');
  if (out.length > MAX_RUNTIME_DISTILL) {
    throw new Error('Invalid response: runtimeDistilledMarkdown exceeds maximum length');
  }
  return { runtimeDistilledMarkdown: out };
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

function excerptMatchesReference(excerpt, reference) {
  const e = normalizeExcerptForMatch(excerpt);
  const r = normalizeExcerptForMatch(reference);
  if (!e || !r) return false;
  if (r.includes(e)) return true;
  if (e.length > 48) {
    const prefix = e.slice(0, Math.min(80, Math.floor(e.length * 0.6)));
    if (prefix.length >= 24 && r.includes(prefix)) return true;
  }
  return false;
}

function sanitizeReferenceExcerpt(excerpt, referenceCorpus, designerNote) {
  const t = String(excerpt || '').trim();
  if (!t || !referenceCorpus?.trim() || !excerptMatchesReference(t, referenceCorpus)) {
    return undefined;
  }
  if (designerNote?.trim() && normalizeExcerptForMatch(t) === normalizeExcerptForMatch(designerNote)) {
    return undefined;
  }
  return t.slice(0, 2000);
}

function parseSuggestedFeatureParameter(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const paramKey = String(raw.paramKey ?? raw.name ?? '').trim();
  if (!paramKey) return null;
  const direction = String(raw.direction ?? 'input').toLowerCase() === 'output' ? 'output' : 'input';
  const kindRaw = String(raw.kind ?? 'required').toLowerCase();
  const kind =
    kindRaw === 'optional' ||
    kindRaw === 'derived' ||
    kindRaw === 'unused' ||
    kindRaw === 'missing'
      ? kindRaw
      : 'required';
  return {
    paramKey,
    direction,
    kind,
    dataType: String(raw.dataType ?? 'string'),
    role: String(raw.role ?? ''),
    descriptionShort: String(raw.descriptionShort ?? raw.description ?? ''),
  };
}

function parseSuggestedFeatureDraft(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title ?? '').trim();
  const purposeMarkdown = String(raw.purposeMarkdown ?? raw.purpose ?? '').trim();
  const paramsRaw = raw.parameters;
  const parameters = [];

  if (Array.isArray(paramsRaw)) {
    for (const item of paramsRaw) {
      const p = parseSuggestedFeatureParameter(item);
      if (p) parameters.push(p);
    }
  } else if (paramsRaw && typeof paramsRaw === 'object') {
    for (const [pk, pr] of Object.entries(paramsRaw)) {
      const p = parseSuggestedFeatureParameter({ ...pr, paramKey: pr?.paramKey ?? pk });
      if (p) parameters.push(p);
    }
  }

  if (!title && !purposeMarkdown && parameters.length === 0) return null;

  const parametersRecord = {};
  for (const p of parameters) parametersRecord[p.paramKey] = p;

  return {
    title: title || 'Funzionalità suggerita',
    purposeMarkdown,
    parameters: parametersRecord,
  };
}

function parseObservationRow(row, idx, referenceCorpus) {
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
  const documentExcerpt = sanitizeReferenceExcerpt(
    row?.documentExcerpt,
    referenceCorpus,
    text
  );
  const excerptRationale =
    documentExcerpt &&
    typeof row?.excerptRationale === 'string' &&
    row.excerptRationale.trim()
      ? row.excerptRationale.trim().slice(0, 500)
      : undefined;

  const suggestsApiExtension = row?.suggestsApiExtension === true;
  const suggestedFeatureDraft = suggestsApiExtension
    ? parseSuggestedFeatureDraft(row?.suggestedFeature ?? row?.suggestedFeatureDraft)
    : undefined;

  return {
    id,
    kind,
    presentation,
    text,
    interpretation,
    ...(documentExcerpt ? { documentExcerpt } : {}),
    ...(excerptRationale ? { excerptRationale } : {}),
    ...(suggestsApiExtension ? { suggestsApiExtension: true } : {}),
    ...(suggestedFeatureDraft ? { suggestedFeatureDraft } : {}),
  };
}

function validateObservationReview(parsed, referenceCorpus) {
  if (!Array.isArray(parsed.observations) || parsed.observations.length === 0) {
    throw new Error('Invalid JSON: expected non-empty observations array');
  }
  const observations = parsed.observations.map((row, idx) =>
    parseObservationRow(row, idx, referenceCorpus)
  );
  return { observations };
}

function validateClarifyObservationResponse(parsed, referenceCorpus, designerNote) {
  const interpretation = typeof parsed.interpretation === 'string' ? parsed.interpretation.trim() : '';
  if (!interpretation) throw new Error('Invalid JSON: expected non-empty interpretation');
  const documentExcerpt = sanitizeReferenceExcerpt(
    parsed.documentExcerpt,
    referenceCorpus,
    designerNote
  );
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

function appendTaskContext(parts, taskContext) {
  const summary = String(taskContext?.agentTaskSummary || '').trim();
  if (summary) parts.push('', '--- Agent task context ---', summary.slice(0, 8_000));
  if (Array.isArray(taskContext?.taskVariables) && taskContext.taskVariables.length > 0) {
    parts.push('', '--- Task variables ---', JSON.stringify(taskContext.taskVariables).slice(0, 4_000));
  }
  if (
    Array.isArray(taskContext?.existingUseCaseSummaries) &&
    taskContext.existingUseCaseSummaries.length > 0
  ) {
    parts.push(
      '',
      '--- Existing use cases ---',
      taskContext.existingUseCaseSummaries.join('\n').slice(0, 4_000)
    );
  }
}

async function proposeBackendAnalysis(params) {
  const referenceCorpus = String(params.referenceCorpus || '').trim();
  if (!referenceCorpus) throw new Error('referenceCorpus is required');
  const parts = [
    '--- Backend reference corpus ---',
    referenceCorpus.slice(0, 48_000),
  ];
  appendTaskContext(parts, params.taskContext);
  return callJsonAnalysis({
    systemPrompt: PROPOSE_SYSTEM,
    userContent: parts.join('\n'),
    provider: params.provider,
    model: params.model,
    aiProviderService: params.aiProviderService,
    purpose: params.purpose,
    taskId: params.taskId,
    taskLabel: params.taskLabel,
    validate: (parsed) => validateMarkdownField(parsed),
  });
}

async function refineBackendAnalysis(params) {
  const draft = String(params.draftMarkdown || '').trim();
  if (!draft) throw new Error('draftMarkdown is required');
  const referenceCorpus = String(params.referenceCorpus || '').trim();
  const parts = [
    '--- Backend reference corpus ---',
    referenceCorpus.slice(0, 32_000),
    '',
    '--- Designer draft ---',
    draft.slice(0, 32_000),
  ];
  appendTaskContext(parts, params.taskContext);
  return callJsonAnalysis({
    systemPrompt: REFINE_SYSTEM,
    userContent: parts.join('\n'),
    provider: params.provider,
    model: params.model,
    aiProviderService: params.aiProviderService,
    purpose: params.purpose,
    taskId: params.taskId,
    taskLabel: params.taskLabel,
    validate: (parsed) => validateMarkdownField(parsed),
  });
}

async function reviewBackendAnalysisObservations(params) {
  const baseline = String(params.agentBaselineMarkdown || '').trim();
  const userDraft = String(params.userDraftMarkdown || '').trim();
  const referenceCorpus = String(params.referenceCorpus || '').trim();
  if (!baseline) throw new Error('agentBaselineMarkdown is required');
  if (!userDraft) throw new Error('userDraftMarkdown is required');
  if (baseline === userDraft) throw new Error('No diff between agent baseline and user draft');
  const parts = [
    '--- Backend reference corpus (for documentExcerpt quotes) ---',
    referenceCorpus.slice(0, 32_000),
    '',
    '--- Agent last analysis ---',
    baseline.slice(0, 32_000),
    '',
    '--- Designer edited analysis ---',
    userDraft.slice(0, 32_000),
  ];
  return callJsonAnalysis({
    systemPrompt: REVIEW_OBSERVATIONS_SYSTEM,
    userContent: parts.join('\n'),
    provider: params.provider,
    model: params.model,
    aiProviderService: params.aiProviderService,
    purpose: params.purpose,
    taskId: params.taskId,
    taskLabel: params.taskLabel,
    validate: (parsed) => validateObservationReview(parsed, referenceCorpus),
  });
}

async function clarifyBackendAnalysisObservation(params) {
  const userCorrection = String(params.userCorrection || '').trim();
  if (!userCorrection) throw new Error('userCorrection is required');
  const referenceCorpus = String(params.referenceCorpus || '').trim();
  const designerNote = String(params.userText || '').trim();
  const parts = [
    '--- Backend reference corpus ---',
    referenceCorpus.slice(0, 24_000),
    '',
    '--- Designer note ---',
    designerNote.slice(0, 8_000),
    '',
    '--- Previous assistant response ---',
    String(params.previousInterpretation || '').slice(0, 8_000),
    '',
    '--- Designer correction ---',
    userCorrection.slice(0, 4_000),
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
    validate: (parsed) =>
      validateClarifyObservationResponse(parsed, referenceCorpus, designerNote),
  });
}

async function finalizeBackendAnalysis(params) {
  const baseline = String(params.agentBaselineMarkdown || '').trim();
  const userDraft = String(params.userDraftMarkdown || '').trim();
  const referenceCorpus = String(params.referenceCorpus || '').trim();
  if (!baseline || !userDraft) throw new Error('agentBaselineMarkdown and userDraftMarkdown are required');
  if (!Array.isArray(params.observations) || params.observations.length === 0) {
    throw new Error('observations are required');
  }
  const parts = [
    '--- Backend reference corpus ---',
    referenceCorpus.slice(0, 16_000),
    '',
    '--- Agent baseline ---',
    baseline.slice(0, 24_000),
    '',
    '--- Designer draft ---',
    userDraft.slice(0, 24_000),
    '',
    '--- Confirmed observations ---',
    JSON.stringify(params.observations).slice(0, 16_000),
  ];
  appendTaskContext(parts, params.taskContext);
  return callJsonAnalysis({
    systemPrompt: FINALIZE_SYSTEM,
    userContent: parts.join('\n'),
    provider: params.provider,
    model: params.model,
    aiProviderService: params.aiProviderService,
    purpose: params.purpose,
    taskId: params.taskId,
    taskLabel: params.taskLabel,
    validate: (parsed) => validateMarkdownField(parsed),
  });
}

function validateSuggestedFeatureField(parsed) {
  const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
  const purposeMarkdown =
    typeof parsed.purposeMarkdown === 'string' ? parsed.purposeMarkdown.trim() : '';
  const parameters = Array.isArray(parsed.parameters) ? parsed.parameters : [];
  if (!title && !purposeMarkdown && parameters.length === 0) {
    throw new Error('Invalid JSON: expected title, purposeMarkdown, or parameters');
  }
  const normalizedParams = [];
  for (const raw of parameters) {
    if (!raw || typeof raw !== 'object') continue;
    const paramKey = String(raw.paramKey ?? raw.name ?? '').trim();
    if (!paramKey) continue;
    const direction = String(raw.direction ?? 'input').toLowerCase() === 'output' ? 'output' : 'input';
    const kindRaw = String(raw.kind ?? 'required').toLowerCase();
    const kind =
      kindRaw === 'optional' ||
      kindRaw === 'derived' ||
      kindRaw === 'unused' ||
      kindRaw === 'missing'
        ? kindRaw
        : 'required';
    normalizedParams.push({
      paramKey,
      direction,
      kind,
      dataType: String(raw.dataType ?? 'string'),
      role: String(raw.role ?? ''),
      descriptionShort: String(raw.descriptionShort ?? raw.description ?? ''),
    });
  }
  return {
    title: title || 'Funzionalità suggerita',
    purposeMarkdown,
    parameters: normalizedParams,
  };
}

async function createSuggestedFeatureFromObservation(params) {
  const designerQuestion = String(params.designerQuestion || '').trim();
  const confirmedInterpretation = String(params.confirmedInterpretation || '').trim();
  const backendLabel = String(params.backendLabel || '').trim();
  const referenceCorpus = String(params.referenceCorpus || '').trim();
  if (!designerQuestion) throw new Error('designerQuestion is required');
  if (!confirmedInterpretation) throw new Error('confirmedInterpretation is required');
  if (!backendLabel) throw new Error('backendLabel is required');
  const parts = [
    `Backend: ${backendLabel}`,
    '',
    '--- Backend reference corpus ---',
    referenceCorpus.slice(0, 32_000),
    '',
    '--- Designer observation (review) ---',
    designerQuestion.slice(0, 8_000),
    '',
    '--- Designer brief (source of truth) ---',
    confirmedInterpretation.slice(0, 12_000),
  ];
  return callJsonAnalysis({
    systemPrompt: CREATE_SUGGESTED_FEATURE_SYSTEM,
    userContent: parts.join('\n'),
    provider: params.provider,
    model: params.model,
    aiProviderService: params.aiProviderService,
    purpose: params.purpose,
    taskId: params.taskId,
    taskLabel: params.taskLabel,
    validate: validateSuggestedFeatureField,
  });
}

async function distillBackendAnalysisRuntime(params) {
  const analysis = String(params.analysisMarkdown || '').trim();
  if (!analysis) throw new Error('analysisMarkdown is required');
  const parts = [
    `Agent task id: ${params.agentTaskId || 'agent'}`,
    '',
    '--- Backend analysis to distill ---',
    analysis.slice(0, 36_000),
  ];
  appendTaskContext(parts, params.taskContext);
  return callJsonAnalysis({
    systemPrompt: BACKEND_DISTILL_RUNTIME_SYSTEM,
    userContent: parts.join('\n'),
    provider: params.provider,
    model: params.model,
    aiProviderService: params.aiProviderService,
    purpose: params.purpose,
    taskId: params.taskId,
    taskLabel: params.taskLabel,
    validate: validateRuntimeDistillField,
  });
}

module.exports = {
  proposeBackendAnalysis,
  refineBackendAnalysis,
  reviewBackendAnalysisObservations,
  clarifyBackendAnalysisObservation,
  finalizeBackendAnalysis,
  createSuggestedFeatureFromObservation,
  distillBackendAnalysisRuntime,
};
