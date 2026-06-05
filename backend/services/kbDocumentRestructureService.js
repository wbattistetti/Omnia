/**
 * KB document restructure: propose and refine canonical less-ambiguous document view.
 */

const { extractJsonString } = require('./AIAgentDesignService');
const kbDocumentRepository = require('./kbDocumentRepository');
const {
  PROPOSE_RESTRUCTURE_SYSTEM,
  REFINE_RESTRUCTURE_SYSTEM,
  REFINE_RESTRUCTURE_WITH_FEEDBACK_SYSTEM,
} = require('./kbDocumentRestructurePrompts');

const TIMEOUT_MS = Number.parseInt(process.env.KB_ANALYSIS_TIMEOUT_MS || '120000', 10);
const MAX_MD = 120_000;

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

async function callJsonRestructure({
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
      temperature: 0.2,
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

function parseClarificationQuestions(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (let i = 0; i < raw.length && out.length < 12; i += 1) {
    const row = raw[i];
    if (!row || typeof row !== 'object') continue;
    const text = typeof row.text === 'string' ? row.text.trim() : '';
    if (!text) continue;
    const id =
      typeof row.id === 'string' && row.id.trim() ? row.id.trim() : `q${i + 1}`;
    const relatedRowKeys = Array.isArray(row.relatedRowKeys)
      ? row.relatedRowKeys
          .filter((k) => typeof k === 'string' && k.trim())
          .map((k) => k.trim())
          .slice(0, 8)
      : [];
    out.push({
      id,
      text,
      ...(relatedRowKeys.length ? { relatedRowKeys } : {}),
    });
  }
  return out;
}

function slugifySelectorColumnId(header) {
  const slug = String(header ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return slug || 'column';
}

function parseSelectorColumn(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const columnId =
    typeof raw.columnId === 'string' && raw.columnId.trim()
      ? slugifySelectorColumnId(raw.columnId)
      : '';
  const headerLabel = typeof raw.headerLabel === 'string' ? raw.headerLabel.trim() : '';
  if (!columnId || !headerLabel) return null;
  const role = raw.role === 'data' ? 'data' : 'selector';
  const promptType = raw.promptType === 'open_question' ? 'open_question' : 'closed_list';
  const sortOrder =
    typeof raw.sortOrder === 'number' && Number.isFinite(raw.sortOrder) ? raw.sortOrder : 0;
  const promptTemplate =
    typeof raw.promptTemplate === 'string' ? raw.promptTemplate.trim() : '';
  if (role === 'selector' && !promptTemplate) return null;
  const askPolicy =
    raw.askPolicy === 'required' || raw.askPolicy === 'optional' ? raw.askPolicy : undefined;
  return {
    columnId,
    headerLabel,
    role,
    promptType,
    sortOrder,
    promptTemplate,
    ...(askPolicy ? { askPolicy } : {}),
    ...(raw.autoFillSingleValue === true ? { autoFillSingleValue: true } : {}),
  };
}

function parseInvalidationTemplate(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : '';
  const template = typeof raw.template === 'string' ? raw.template.trim() : '';
  if (!id || !template) return null;
  return {
    id,
    template,
    approved: raw.approved === true,
  };
}

function parseSelectorSpec(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const columns = [];
  for (const c of Array.isArray(raw.columns) ? raw.columns : []) {
    const parsed = parseSelectorColumn(c);
    if (parsed) columns.push(parsed);
  }
  if (columns.length === 0) return null;
  const invalidationTemplates = [];
  for (const t of Array.isArray(raw.invalidationTemplates) ? raw.invalidationTemplates : []) {
    const parsed = parseInvalidationTemplate(t);
    if (parsed) invalidationTemplates.push(parsed);
  }
  return {
    schemaVersion: 1,
    columns: columns.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.headerLabel.localeCompare(b.headerLabel, 'it')
    ),
    invalidationTemplates,
  };
}

function validateRestructureResponse(parsed) {
  const data =
    typeof parsed.documentRestructuredMarkdown === 'string'
      ? parsed.documentRestructuredMarkdown.trim()
      : '';
  if (!data) throw new Error('Invalid JSON: expected non-empty documentRestructuredMarkdown');
  if (data.length > MAX_MD) {
    throw new Error('Invalid response: documentRestructuredMarkdown exceeds maximum length');
  }
  const notes =
    typeof parsed.documentRestructureNotesMarkdown === 'string'
      ? parsed.documentRestructureNotesMarkdown.trim()
      : '';
  if (notes.length > MAX_MD) {
    throw new Error('Invalid response: documentRestructureNotesMarkdown exceeds maximum length');
  }
  const clarificationQuestions = parseClarificationQuestions(parsed.clarificationQuestions);
  const selectorSpec = parseSelectorSpec(parsed.selectorSpec);
  return {
    documentRestructuredMarkdown: data,
    documentRestructureNotesMarkdown: notes,
    clarificationQuestions,
    ...(selectorSpec ? { selectorSpec } : {}),
  };
}

async function proposeDocumentRestructure(params) {
  const sample = loadDocumentSample(
    params.projectId,
    params.repositoryDocumentId,
    params.documentSampleText
  );
  if (!sample.trim()) {
    throw new Error('Document sample is empty — cannot propose restructure');
  }
  const parts = [
    `Document name: ${params.documentName || 'document'}`,
    '',
    '--- Document sample (restructure this) ---',
    sample.slice(0, 24_000),
  ];
  appendTaskContext(parts, params);
  return callJsonRestructure({
    systemPrompt: PROPOSE_RESTRUCTURE_SYSTEM,
    userContent: parts.join('\n'),
    provider: params.provider,
    model: params.model,
    aiProviderService: params.aiProviderService,
    purpose: params.purpose,
    taskId: params.taskId,
    taskLabel: params.taskLabel,
    validate: validateRestructureResponse,
  });
}

async function refineDocumentRestructure(params) {
  const draft = String(params.draftMarkdown || '').trim();
  if (!draft) throw new Error('draftMarkdown is required');
  const sample = loadDocumentSample(
    params.projectId,
    params.repositoryDocumentId,
    params.documentSampleText
  );
  const parts = [
    `Document name: ${params.documentName || 'document'}`,
    '',
    '--- User draft normalized DATA TABLE only (refine this) ---',
    draft.slice(0, 48_000),
  ];
  if (sample.trim()) {
    parts.push('', '--- Document sample (reference only) ---', sample.slice(0, 24_000));
  }
  appendTaskContext(parts, params);
  const result = await callJsonRestructure({
    systemPrompt: REFINE_RESTRUCTURE_SYSTEM,
    userContent: parts.join('\n'),
    provider: params.provider,
    model: params.model,
    aiProviderService: params.aiProviderService,
    purpose: params.purpose,
    taskId: params.taskId,
    taskLabel: params.taskLabel,
    validate: validateRestructureResponse,
  });
  return {
    documentRestructuredMarkdown: result.documentRestructuredMarkdown,
    documentRestructureNotesMarkdown: result.documentRestructureNotesMarkdown || '',
    clarificationQuestions: result.clarificationQuestions || [],
    ...(result.selectorSpec ? { selectorSpec: result.selectorSpec } : {}),
  };
}

function normalizeRowNotesWire(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const note = String(value ?? '').trim();
    if (String(key).trim() && note) out[String(key).trim()] = note.slice(0, 2_000);
  }
  return out;
}

function normalizeQuestionAnswersWire(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const question = typeof row.question === 'string' ? row.question.trim() : '';
    const answer = typeof row.answer === 'string' ? row.answer.trim() : '';
    if (!id || !answer) continue;
    out.push({
      id,
      question: question || id,
      answer: answer.slice(0, 4_000),
    });
    if (out.length >= 20) break;
  }
  return out;
}

function appendDesignerFeedback(parts, { rowNotes, questionAnswers, designerFeedback }) {
  const notes = normalizeRowNotesWire(rowNotes);
  const answers = normalizeQuestionAnswersWire(questionAnswers);
  const freeText = String(designerFeedback || '').trim().slice(0, 8_000);

  if (Object.keys(notes).length > 0) {
    parts.push('', '--- Designer row notes ---');
    for (const [key, note] of Object.entries(notes)) {
      parts.push(`- ${key}: ${note}`);
    }
  }
  if (answers.length > 0) {
    parts.push('', '--- Designer answers to clarification questions ---');
    for (const qa of answers) {
      parts.push(`Q [${qa.id}] ${qa.question}`);
      parts.push(`A: ${qa.answer}`);
    }
  }
  if (freeText) {
    parts.push('', '--- Designer observations ---', freeText);
  }
}

async function refineDocumentRestructureWithFeedback(params) {
  const draft = String(params.draftMarkdown || '').trim();
  if (!draft) throw new Error('draftMarkdown is required');
  const sample = loadDocumentSample(
    params.projectId,
    params.repositoryDocumentId,
    params.documentSampleText
  );
  const parts = [
    `Document name: ${params.documentName || 'document'}`,
    '',
    '--- Current normalized DATA TABLE (refine using designer feedback) ---',
    draft.slice(0, 48_000),
  ];
  appendDesignerFeedback(parts, params);
  if (sample.trim()) {
    parts.push('', '--- Document sample (reference only) ---', sample.slice(0, 24_000));
  }
  appendTaskContext(parts, params);
  const result = await callJsonRestructure({
    systemPrompt: REFINE_RESTRUCTURE_WITH_FEEDBACK_SYSTEM,
    userContent: parts.join('\n'),
    provider: params.provider,
    model: params.model,
    aiProviderService: params.aiProviderService,
    purpose: params.purpose,
    taskId: params.taskId,
    taskLabel: params.taskLabel,
    validate: validateRestructureResponse,
  });
  return {
    documentRestructuredMarkdown: result.documentRestructuredMarkdown,
    documentRestructureNotesMarkdown: result.documentRestructureNotesMarkdown || '',
    clarificationQuestions: result.clarificationQuestions || [],
    ...(result.selectorSpec ? { selectorSpec: result.selectorSpec } : {}),
  };
}

module.exports = {
  proposeDocumentRestructure,
  refineDocumentRestructure,
  refineDocumentRestructureWithFeedback,
};
