/**
 * Analisi semantica sovrapposizioni use case (singolo + catalogo).
 */

const { extractJsonString } = require('./AIAgentDesignService');
const { ANALYZE_ONE_SYSTEM, CHECK_CATALOG_SYSTEM } = require('./useCaseOverlapPrompts');

const TIMEOUT_MS = Number.parseInt(process.env.USE_CASE_OVERLAP_TIMEOUT_MS || '120000', 10);
const DEFAULT_THRESHOLD = 0.8;

function compactUseCaseForOverlap(uc, catalogNumber) {
  if (!uc || typeof uc !== 'object') return null;
  const scenario =
    uc.scenario && typeof uc.scenario === 'object'
      ? String(uc.scenario.llm || '').slice(0, 1500)
      : String(uc.payoff || '').slice(0, 1500);
  const assistant = Array.isArray(uc.dialogue)
    ? uc.dialogue.find((t) => t && t.role === 'assistant')
    : null;
  return {
    id: String(uc.id || ''),
    catalog_number: typeof catalogNumber === 'number' ? catalogNumber : undefined,
    label: String(uc.label || '').slice(0, 160),
    scenario,
    assistant_excerpt:
      assistant && typeof assistant.content === 'string'
        ? assistant.content.slice(0, 500)
        : '',
  };
}

function buildCatalogCompactList(useCases, numberById) {
  return useCases
    .map((uc) => compactUseCaseForOverlap(uc, numberById?.get?.(uc.id)))
    .filter(Boolean);
}

function validateAnalyzeOne(parsed, threshold) {
  const classification = ['duplicate', 'variant', 'new'].includes(parsed.classification)
    ? parsed.classification
    : 'new';
  const score =
    typeof parsed.score === 'number' && Number.isFinite(parsed.score)
      ? Math.max(0, Math.min(1, parsed.score))
      : 0;
  const related = Array.isArray(parsed.related)
    ? parsed.related
        .filter((r) => r && typeof r === 'object' && r.use_case_id)
        .slice(0, 5)
        .map((r) => ({
          use_case_id: String(r.use_case_id),
          relation: r.relation === 'duplicate_of' ? 'duplicate_of' : 'variant_of',
          score:
            typeof r.score === 'number' && Number.isFinite(r.score)
              ? Math.max(0, Math.min(1, r.score))
              : score,
          reason: typeof r.reason === 'string' ? r.reason.slice(0, 400) : '',
        }))
    : [];
  return {
    classification,
    score,
    primary_intent:
      typeof parsed.primary_intent === 'string' ? parsed.primary_intent.slice(0, 500) : '',
    related,
    designer_message:
      typeof parsed.designer_message === 'string' ? parsed.designer_message.slice(0, 600) : '',
    threshold,
  };
}

function validateCheckReport(parsed, threshold) {
  const clusters = Array.isArray(parsed.clusters) ? parsed.clusters : [];
  const outClusters = [];
  let pairCount = 0;
  for (const c of clusters) {
    if (!c || typeof c !== 'object') continue;
    const use_case_ids = Array.isArray(c.use_case_ids)
      ? c.use_case_ids.map(String).filter(Boolean)
      : [];
    const pairs = Array.isArray(c.pairs) ? c.pairs : [];
    const outPairs = [];
    for (const p of pairs) {
      if (!p || typeof p !== 'object') continue;
      const score =
        typeof p.score === 'number' && Number.isFinite(p.score)
          ? Math.max(0, Math.min(1, p.score))
          : 0;
      if (score < threshold) continue;
      outPairs.push({
        use_case_a_id: String(p.use_case_a_id || ''),
        use_case_b_id: String(p.use_case_b_id || ''),
        classification: p.classification === 'duplicate' ? 'duplicate' : 'variant',
        score,
        summary: typeof p.summary === 'string' ? p.summary.slice(0, 400) : '',
      });
    }
    pairCount += outPairs.length;
    if (outPairs.length === 0 && use_case_ids.length < 2) continue;
    outClusters.push({
      cluster_id: String(c.cluster_id || `cluster-${outClusters.length + 1}`),
      classification: c.classification === 'duplicate' ? 'duplicate' : 'variant',
      use_case_ids,
      headline: typeof c.headline === 'string' ? c.headline.slice(0, 200) : '',
      pairs: outPairs,
    });
  }
  return {
    threshold,
    pair_count: typeof parsed.pair_count === 'number' ? parsed.pair_count : pairCount,
    clusters: outClusters,
    generated_at: new Date().toISOString(),
  };
}

async function callOverlapJson({ system, userPayload, provider, model, aiProviderService, purpose, taskId, taskLabel }) {
  const userDesc = JSON.stringify(userPayload);
  const response = await aiProviderService.callAI({
    provider,
    model,
    systemPrompt: system,
    userDesc,
    temperature: 0.2,
    maxTokens: 4096,
    timeout: TIMEOUT_MS,
    purpose,
    taskId,
    taskLabel,
  });
  const parsed = JSON.parse(extractJsonString(response));
  return parsed;
}

/**
 * Analizza un use case rispetto al catalogo esistente.
 */
async function analyzeUseCaseOverlap(params) {
  const threshold =
    typeof params.threshold === 'number' && Number.isFinite(params.threshold)
      ? params.threshold
      : DEFAULT_THRESHOLD;
  const candidate = params.candidateUseCase;
  const catalog = Array.isArray(params.catalogUseCases) ? params.catalogUseCases : [];
  const numberById = params.catalogNumberById || null;
  const others = catalog.filter((uc) => uc && uc.id !== candidate?.id);
  const userPayload = {
    THRESHOLD: threshold,
    candidate: compactUseCaseForOverlap(
      candidate,
      numberById?.get?.(candidate?.id)
    ),
    existing_catalog: buildCatalogCompactList(others, numberById),
  };
  const parsed = await callOverlapJson({
    system: ANALYZE_ONE_SYSTEM.replace(/THRESHOLD/g, String(threshold)),
    userPayload,
    provider: params.provider,
    model: params.model,
    aiProviderService: params.aiProviderService,
    purpose: params.purpose,
    taskId: params.taskId,
    taskLabel: params.taskLabel,
  });
  return validateAnalyzeOne(parsed, threshold);
}

/**
 * Verifica sovrapposizioni su tutto il catalogo.
 */
async function checkUseCaseOverlaps(params) {
  const threshold =
    typeof params.threshold === 'number' && Number.isFinite(params.threshold)
      ? params.threshold
      : DEFAULT_THRESHOLD;
  const catalog = Array.isArray(params.useCases) ? params.useCases : [];
  const numberById = params.catalogNumberById || null;
  const userPayload = {
    THRESHOLD: threshold,
    catalog: buildCatalogCompactList(catalog, numberById),
  };
  const parsed = await callOverlapJson({
    system: CHECK_CATALOG_SYSTEM.replace(/THRESHOLD/g, String(threshold)),
    userPayload,
    provider: params.provider,
    model: params.model,
    aiProviderService: params.aiProviderService,
    purpose: params.purpose,
    taskId: params.taskId,
    taskLabel: params.taskLabel,
  });
  return validateCheckReport(parsed, threshold);
}

module.exports = {
  analyzeUseCaseOverlap,
  checkUseCaseOverlaps,
  DEFAULT_THRESHOLD,
};
