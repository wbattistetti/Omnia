/**
 * Semantic KB analysis: classify data types, guided chat, induced rules.
 */

const kbRepo = require('./kbDocumentRepository');
const {
  ANALYZE_SEMANTIC_SYSTEM,
  REANALYZE_SYSTEM,
  CHAT_SYSTEM,
  CHAT_START_SYSTEM,
  stripJsonFence,
  buildRulesSummaryIt,
} = require('./kbSemanticPrompts');

const MAX_SAMPLE_CHARS = 100_000;

/** KB semantic passes can exceed default 60s provider timeout on large documents. */
const KB_SEMANTIC_TIMEOUT_MS =
  parseInt(process.env.KB_SEMANTIC_TIMEOUT_MS || '', 10) || 120_000;

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Model returned empty content');
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error('Model response is not valid JSON');
  }
}

function normalizeDataTypes(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => String(t || '').trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeRuleStatus(raw, included) {
  const s = String(raw || '').trim().toLowerCase();
  const map = {
    hypothesized: 'hypothesized',
    hypothesis: 'hypothesized',
    validated: 'validated',
    confirmed: 'validated',
    corrected: 'corrected',
    reworked: 'reworked',
    invalid: 'invalid',
    rejected: 'invalid',
    skipped: 'invalid',
    deferred: 'hypothesized',
  };
  if (map[s]) return map[s];
  return included === false ? 'invalid' : 'hypothesized';
}

function normalizeConfidence(raw) {
  const c = String(raw || '').trim();
  if (c === 'high' || c === 'medium' || c === 'low') return c;
  return 'medium';
}

function normalizeRules(rules) {
  if (!Array.isArray(rules)) return [];
  return rules
    .map((r, i) => {
      if (!r || typeof r !== 'object') return null;
      const field = String(r.field || r.campo || '').trim();
      const rule = String(r.rule || r.regola || '').trim();
      const title = String(r.title || r.titolo || '').trim();
      if (!field && !rule && !title) return null;
      const id = String(r.id || `rule_${i + 1}`).trim() || `rule_${i + 1}`;
      let validation = r.validation;
      if (validation !== 'up' && validation !== 'down') validation = null;
      const ruleText = rule || '—';
      const status = normalizeRuleStatus(r.status, r.included !== false);
      const confidence = normalizeConfidence(r.confidence);
      const rel = String(r.relevanceToTask || '').trim();
      const rawKind = String(r.ruleKind || r.kind || '').trim().toLowerCase();
      const ruleKind =
        rawKind === 'macro' || rawKind === 'micro' ? rawKind : 'atomic';
      const parentRuleId =
        ruleKind === 'macro'
          ? null
          : String(r.parentRuleId || r.parentId || '').trim() || null;
      return {
        id,
        ruleKind,
        parentRuleId,
        title: title || field || ruleText.slice(0, 72),
        field: field || '—',
        rule: ruleText,
        evidence: String(r.evidence || r.evidenza || '').trim(),
        note: String(r.note || r.notes || '').trim(),
        included: status !== 'invalid',
        validation,
        status,
        confidence,
        trigger: String(r.trigger || '').trim(),
        action: String(r.action || r.azione || '').trim(),
        fallback: String(r.fallback || '').trim(),
        relevanceToTask: rel === 'high' || rel === 'low' ? rel : undefined,
      };
    })
    .filter(Boolean);
}

function normalizeAnalysisPayload(parsed) {
  const structure =
    parsed?.structure && typeof parsed.structure === 'object' ? parsed.structure : {};
  const dataTypes = normalizeDataTypes(parsed?.dataTypes).slice(0, 6);
  const rules = normalizeRules(parsed?.rules);
  const analysisNote =
    typeof parsed?.analysisNote === 'string' ? parsed.analysisNote.trim() : '';
  const reviewOpener =
    typeof parsed?.reviewOpener === 'string' ? parsed.reviewOpener.trim() : '';
  const chatOpener =
    reviewOpener ||
    (typeof parsed?.chatOpener === 'string' ? parsed.chatOpener.trim() : '');
  return { structure, dataTypes, rules, analysisNote, chatOpener, reviewOpener };
}

async function callJsonModel({
  system,
  user,
  provider,
  model,
  aiProviderService,
  purpose,
  taskId,
  taskLabel,
}) {
  const response = await aiProviderService.callAI(
    provider,
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    {
      model,
      temperature: 0.25,
      maxTokens: provider === 'openai' ? 4096 : 8192,
      timeout: KB_SEMANTIC_TIMEOUT_MS,
      purpose,
      taskId,
      taskLabel,
    }
  );
  const content = response?.choices?.[0]?.message?.content;
  return normalizeAnalysisPayload(extractJsonObject(content));
}

function buildDocumentUserBlock({
  documentName,
  sampleText,
  truncated,
  totalChars,
  variables,
  structureJson,
  rules,
  dataTypes,
  analysisIntent,
  agentTaskSummary,
  taskVariables,
  existingUseCaseSummaries,
  currentRuleId,
}) {
  const varLines =
    Array.isArray(variables) && variables.length > 0
      ? variables.map((v) => `- ${v.sourceColumn} → ${v.placeholder}`).join('\n')
      : '- (none)';

  const truncNote = truncated
    ? `\n[NOTA: testo troncato a ${sampleText.length} caratteri su ${totalChars} totali]\n`
    : '';

  let rulesBlock = '';
  if (Array.isArray(rules) && rules.length > 0) {
    rulesBlock = `\nRegole attuali (JSON):\n${JSON.stringify(rules, null, 2)}\n`;
  }

  let structureBlock = '';
  if (structureJson && String(structureJson).trim()) {
    structureBlock = `\nStruttura (JSON):\n${String(structureJson).trim()}\n`;
  }

  const typesBlock =
    Array.isArray(dataTypes) && dataTypes.length > 0
      ? `\nTipi di dato rilevati:\n${dataTypes.map((t) => `- ${t}`).join('\n')}\n`
      : '';

  const intentBlock =
    analysisIntent && String(analysisIntent).trim()
      ? `\nObiettivo analisi (dal designer in chat):\n${String(analysisIntent).trim()}\n`
      : '';

  const taskBlock =
    agentTaskSummary && String(agentTaskSummary).trim()
      ? `\n--- AGENT TASK (evaluate every rule against this) ---\n${String(agentTaskSummary).trim()}\n`
      : '';

  let taskVarBlock = '';
  if (Array.isArray(taskVariables) && taskVariables.length > 0) {
    taskVarBlock = `\nTask variables (agent I/O):\n${taskVariables
      .map((v) => {
        if (!v || typeof v !== 'object') return '';
        const label = String(v.label || v.slotId || v.internalName || '').trim();
        const slot = String(v.slotId || v.internalName || '').trim();
        return label ? `- ${label}${slot ? ` (${slot})` : ''}` : '';
      })
      .filter(Boolean)
      .join('\n')}\n`;
  }

  let ucBlock = '';
  if (Array.isArray(existingUseCaseSummaries) && existingUseCaseSummaries.length > 0) {
    ucBlock = `\nExisting use cases on task (avoid duplicates):\n${existingUseCaseSummaries
      .map((u) => `- ${String(u).trim()}`)
      .filter(Boolean)
      .join('\n')}\n`;
  }

  const currentRuleBlock =
    currentRuleId && String(currentRuleId).trim()
      ? `\nCURRENT RULE UNDER REVIEW (id): ${String(currentRuleId).trim()}\n`
      : '';

  return `Document: ${documentName}
${taskBlock}${taskVarBlock}${ucBlock}${currentRuleBlock}
${truncNote}
${typesBlock}
${intentBlock}
Colonne/variabili deterministiche:
${varLines}
${structureBlock}
${rulesBlock}
--- DOCUMENT CONTENT ---
${sampleText}`;
}

async function readSample(projectId, repositoryDocumentId, sampleTextOverride) {
  let sample = sampleTextOverride;
  let truncated = false;
  let totalChars = sample?.length || 0;
  if (!sample && repositoryDocumentId && projectId) {
    const hit = kbRepo.readDocumentText(projectId, repositoryDocumentId, {
      maxChars: MAX_SAMPLE_CHARS,
    });
    if (!hit) throw new Error('Documento non trovato nel repository');
    sample = hit.text;
    truncated = hit.truncated;
    totalChars = hit.totalChars;
  }
  if (!String(sample || '').trim()) {
    throw new Error('Contenuto documento vuoto o non disponibile');
  }
  return { sample, truncated, totalChars };
}

async function analyzeSemantic(params) {
  const {
    projectId,
    repositoryDocumentId,
    documentName,
    variables,
    analysisIntent,
    agentTaskSummary,
    taskVariables,
    existingUseCaseSummaries,
    provider,
    model,
    aiProviderService,
    purpose,
    taskId,
    taskLabel,
    sampleTextOverride,
  } = params;

  const { sample, truncated, totalChars } = await readSample(
    projectId,
    repositoryDocumentId,
    sampleTextOverride
  );

  const user = buildDocumentUserBlock({
    documentName,
    sampleText: sample,
    truncated,
    totalChars,
    variables,
    analysisIntent,
    agentTaskSummary,
    taskVariables,
    existingUseCaseSummaries,
  });

  const out = await callJsonModel({
    system: ANALYZE_SEMANTIC_SYSTEM,
    user,
    provider,
    model,
    aiProviderService,
    purpose: purpose || 'KB_ANALYZE_SEMANTIC',
    taskId,
    taskLabel,
  });

  const result = {
    ...out,
    truncated,
    totalChars,
  };
  if (truncated && !result.analysisNote) {
    result.analysisNote = `Analisi su anteprima (${sample.length}/${totalChars} caratteri).`;
  }
  return result;
}

async function reanalyzeRules(params) {
  const {
    projectId,
    repositoryDocumentId,
    documentName,
    variables,
    structureJson,
    rules,
    dataTypes,
    analysisIntent,
    agentTaskSummary,
    taskVariables,
    existingUseCaseSummaries,
    provider,
    model,
    aiProviderService,
    purpose,
    taskId,
    taskLabel,
  } = params;

  const { sample, truncated, totalChars } = await readSample(projectId, repositoryDocumentId);
  const activeRules = (Array.isArray(rules) ? rules : []).filter((r) => r && !r.deleted);

  const user = buildDocumentUserBlock({
    documentName,
    sampleText: sample,
    truncated,
    totalChars,
    variables,
    structureJson,
    rules: activeRules,
    dataTypes,
    analysisIntent,
    agentTaskSummary,
    taskVariables,
    existingUseCaseSummaries,
  });

  const out = await callJsonModel({
    system: REANALYZE_SYSTEM,
    user,
    provider,
    model,
    aiProviderService,
    purpose: purpose || 'KB_REANALYZE_RULES',
    taskId,
    taskLabel,
  });

  if (truncated && !out.analysisNote) {
    out.analysisNote = `Rianalisi su anteprima (${sample.length}/${totalChars} caratteri).`;
  }
  return { ...out, truncated, totalChars };
}

async function startChatSession({
  projectId,
  repositoryDocumentId,
  documentName,
  variables,
  structureJson,
  dataTypes,
  provider,
  model,
  aiProviderService,
  purpose,
  taskId,
  taskLabel,
}) {
  const { sample, truncated, totalChars } = await readSample(projectId, repositoryDocumentId);

  const context = buildDocumentUserBlock({
    documentName,
    sampleText: sample,
    truncated,
    totalChars,
    variables,
    structureJson,
    dataTypes,
    rules: [],
  });

  const response = await aiProviderService.callAI(
    provider,
    [
      { role: 'system', content: `${CHAT_START_SYSTEM}\n\n--- CONTEXT ---\n${context}` },
      {
        role: 'user',
        content:
          'Avvia la sessione di analisi guidata. Chiedi al designer cosa vuole approfondire.',
      },
    ],
    {
      model,
      temperature: 0.4,
      maxTokens: provider === 'openai' ? 1024 : 2048,
      purpose: purpose || 'KB_CHAT_START',
      taskId,
      taskLabel,
    }
  );

  const reply = String(response?.choices?.[0]?.message?.content || '').trim();
  return { reply, rulePatch: null, truncated, totalChars };
}

async function chatAboutDocument({
  projectId,
  repositoryDocumentId,
  documentName,
  variables,
  structureJson,
  rules,
  dataTypes,
  messages,
  userMessage,
  agentTaskSummary,
  taskVariables,
  existingUseCaseSummaries,
  currentRuleId,
  provider,
  model,
  aiProviderService,
  purpose,
  taskId,
  taskLabel,
}) {
  const { sample, truncated, totalChars } = await readSample(projectId, repositoryDocumentId);

  const context = buildDocumentUserBlock({
    documentName,
    sampleText: sample,
    truncated,
    totalChars,
    variables,
    structureJson,
    rules: (Array.isArray(rules) ? rules : []).filter((r) => r && !r.deleted),
    dataTypes,
    agentTaskSummary,
    taskVariables,
    existingUseCaseSummaries,
    currentRuleId,
  });

  const history = Array.isArray(messages) ? messages : [];
  const llmMessages = [
    { role: 'system', content: `${CHAT_SYSTEM}\n\n--- CONTEXT ---\n${context}` },
    ...history
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
      .slice(-12)
      .map((m) => ({ role: m.role, content: String(m.content || '') })),
    { role: 'user', content: String(userMessage || '').trim() },
  ];

  const response = await aiProviderService.callAI(provider, llmMessages, {
    model,
    temperature: 0.35,
    maxTokens: provider === 'openai' ? 4096 : 8192,
    timeout: KB_SEMANTIC_TIMEOUT_MS,
    purpose: purpose || 'KB_CHAT',
    taskId,
    taskLabel,
  });

  const content = String(response?.choices?.[0]?.message?.content || '').trim();
  let rulePatch = null;
  const jsonFence = content.match(/```json\s*([\s\S]*?)```/i);
  if (jsonFence) {
    try {
      rulePatch = normalizeAnalysisPayload(extractJsonObject(jsonFence[1]));
    } catch {
      rulePatch = null;
    }
  }

  const prose = stripJsonFence(content);
  const mergedRules = rulePatch?.rules?.length ? rulePatch.rules : [];
  const reply =
    prose.length >= 12
      ? prose
      : buildRulesSummaryIt(mergedRules);

  return {
    reply,
    rulePatch,
    truncated,
    totalChars,
  };
}

module.exports = {
  analyzeSemantic,
  reanalyzeRules,
  startChatSession,
  chatAboutDocument,
  normalizeAnalysisPayload,
};
