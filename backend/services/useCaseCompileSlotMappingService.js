/**
 * Proposta IA mapping compile: path-first RECEIVE/SEND + lessico canonico.
 */

const { extractJsonString } = require('./AIAgentDesignService');
const { COMPILE_SLOT_MAPPING_SYSTEM, CORE_SLOT_IDS } = require('./useCaseCompileSlotMappingPrompts');

const TIMEOUT_MS = Number.parseInt(process.env.USE_CASE_COMPILE_SLOT_MAPPING_TIMEOUT_MS || '120000', 10);

const TOKEN_BASE_TO_CANONICAL = {
  giorno: 'data',
  ora: 'orario',
  time: 'orario',
};

function normalizeSurface(s) {
  return String(s ?? '').trim().toLowerCase();
}

function normalizeProposalSlotId(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return null;
  if (CORE_SLOT_IDS.includes(s)) return s;
  if (TOKEN_BASE_TO_CANONICAL[s] && CORE_SLOT_IDS.includes(TOKEN_BASE_TO_CANONICAL[s])) {
    return TOKEN_BASE_TO_CANONICAL[s];
  }
  const m = /^([a-z]+)\d+$/.exec(s);
  if (m) {
    const base = m[1];
    if (CORE_SLOT_IDS.includes(base)) return base;
    if (TOKEN_BASE_TO_CANONICAL[base]) return TOKEN_BASE_TO_CANONICAL[base];
  }
  const mUnderscoreNum = /^([a-z]+)_(\d+)$/.exec(s);
  if (mUnderscoreNum && TOKEN_BASE_TO_CANONICAL[mUnderscoreNum[1]]) {
    return TOKEN_BASE_TO_CANONICAL[mUnderscoreNum[1]];
  }
  const mPrefix = /^([a-z]+)_/.exec(s);
  if (mPrefix && TOKEN_BASE_TO_CANONICAL[mPrefix[1]]) {
    return TOKEN_BASE_TO_CANONICAL[mPrefix[1]];
  }
  return null;
}

function buildUserMessage({
  surfaces,
  phraseTokens,
  receivePaths,
  receiveParamLeaves,
  backendTaskId,
  backendToolContexts,
  sendParamLeaves,
}) {
  const tools = Array.isArray(backendToolContexts) ? backendToolContexts : [];
  const leaves = Array.isArray(sendParamLeaves) ? sendParamLeaves : [];
  const receiveLeaves = Array.isArray(receiveParamLeaves) ? receiveParamLeaves : [];
  const tokens = Array.isArray(phraseTokens) ? phraseTokens : [];
  return `CORE_SLOT_IDS (canonical slot_id — required on contracts/lexicon):
${JSON.stringify(CORE_SLOT_IDS)}

Surfaces (literal [inner] text from phrases):
${JSON.stringify(surfaces.slice(0, 80))}

Phrase tokens (compiled names e.g. giorno_1, ora_2 — bind to RECEIVE when possible):
${JSON.stringify(tokens.slice(0, 80))}

Backend tools (exact toolName; receivePathTree shows nested RECEIVE structure):
${JSON.stringify(tools.slice(0, 20), null, 0)}

Flat RECEIVE api paths (default backendTaskId="${String(backendTaskId || '').trim()}"):
${JSON.stringify(receivePaths.slice(0, 120))}

RECEIVE param leaves (OpenAPI walk — bind phrase_tokens here; use exact path):
${JSON.stringify(receiveLeaves.slice(0, 96))}

SEND param leaves (use ONLY these sendPath values in send_hints):
${JSON.stringify(leaves.slice(0, 80))}

Return JSON:
{
  "lexicon_mappings": [ { "surface": "giorno_1", "slot_id": "data" } ],
  "token_bindings": [ { "token": "giorno_1", "apiPath": "slots[].date", "slotId": "data", "format": "YYYY-MM-DD" } ],
  "backend_bindings": [ { "apiPath": "slots[].date", "slotId": "data", "tokenInPhrase": "data", "format": "YYYY-MM-DD" } ],
  "slot_contracts": [ { "slotId": "data", "toolName": "<from backend_tools>", "receive": "slots[].date", "send": [], "backendTaskId": "<id>", "format": "YYYY-MM-DD" } ],
  "send_hints": [ { "surface": "fine mese", "slotId": "datarelativa", "role": "constraint", "sendPath": "<from SEND leaves>", "valueKind": "end_of_month" } ]
}
REQUIRED: lexicon_mappings must cover every surface listed. token_bindings must cover every phrase_token mappable to RECEIVE.
For each phrase_token also add a lexicon_mappings row (surface = token, slot_id canonical).
slot_contracts: one row per canonical slot_id used. Valid JSON only.`;
}

function parseProposal(parsed, sendParamLeaves, allowedReceivePaths) {
  const receiveSet = new Set(
    (Array.isArray(allowedReceivePaths) ? allowedReceivePaths : [])
      .map((p) => String(p).trim())
      .filter(Boolean)
  );

  const lexicon_mappings = Array.isArray(parsed.lexicon_mappings)
    ? parsed.lexicon_mappings
        .map((r) => {
          if (!r || typeof r !== 'object') return null;
          const surface = normalizeSurface(r.surface);
          const slot_id = normalizeProposalSlotId(r.slot_id);
          if (!surface || !slot_id) return null;
          return { surface, slot_id };
        })
        .filter(Boolean)
    : [];

  const upsertBackend = (apiPath, slotId, tokenInPhrase, format) => {
    const path = String(apiPath ?? '').trim();
    const sid = normalizeProposalSlotId(slotId);
    if (!path || !sid) return null;
    if (receiveSet.size > 0 && !receiveSet.has(path)) return null;
    const tip = String(tokenInPhrase ?? sid).trim().toLowerCase();
    return {
      apiPath: path,
      slotId: sid,
      tokenInPhrase: tip,
      ...(typeof format === 'string' && format.trim() ? { format: format.trim() } : {}),
    };
  };

  const backend_bindings = Array.isArray(parsed.backend_bindings)
    ? parsed.backend_bindings
        .map((r) => {
          if (!r || typeof r !== 'object') return null;
          return upsertBackend(r.apiPath, r.slotId ?? r.slot_id, r.tokenInPhrase ?? r.token, r.format);
        })
        .filter(Boolean)
    : [];

  const token_bindings = Array.isArray(parsed.token_bindings)
    ? parsed.token_bindings
        .map((r) => {
          if (!r || typeof r !== 'object') return null;
          const token = String(r.token ?? '').trim().toLowerCase();
          const row = upsertBackend(r.apiPath, r.slotId ?? r.slot_id, token, r.format);
          if (!token || !row) return null;
          return { token, apiPath: row.apiPath, slotId: row.slotId, ...(row.format ? { format: row.format } : {}) };
        })
        .filter(Boolean)
    : [];

  const slot_contracts = Array.isArray(parsed.slot_contracts)
    ? parsed.slot_contracts
        .map((r) => {
          if (!r || typeof r !== 'object') return null;
          const slotId = normalizeProposalSlotId(r.slotId ?? r.slot_id);
          const toolName = String(r.toolName ?? r.tool ?? '').trim();
          const receive = String(r.receive ?? r.fillFrom ?? '').trim();
          if (!slotId || !receive) return null;
          if (receiveSet.size > 0 && !receiveSet.has(receive)) return null;
          const sendRaw = r.send ?? r.sendParams;
          const send = Array.isArray(sendRaw)
            ? sendRaw.map((s) => String(s).trim()).filter(Boolean)
            : undefined;
          const format = typeof r.format === 'string' && r.format.trim() ? r.format.trim() : undefined;
          const backendTaskId =
            typeof r.backendTaskId === 'string' && r.backendTaskId.trim()
              ? r.backendTaskId.trim()
              : undefined;
          return {
            slotId,
            toolName,
            receive,
            ...(send?.length ? { send } : {}),
            ...(format ? { format } : {}),
            ...(backendTaskId ? { backendTaskId } : {}),
          };
        })
        .filter(Boolean)
    : [];

  const allowedSendPaths = new Set(
    (Array.isArray(sendParamLeaves) ? sendParamLeaves : [])
      .map((l) => String(l?.path ?? '').trim())
      .filter(Boolean)
  );

  const send_hints = Array.isArray(parsed.send_hints)
    ? parsed.send_hints
        .map((r) => {
          if (!r || typeof r !== 'object') return null;
          const surface = normalizeSurface(r.surface);
          const slotId = normalizeProposalSlotId(r.slotId ?? r.slot_id);
          const sendPath = String(r.sendPath ?? '').trim();
          const role = r.role === 'constraint' ? 'constraint' : r.role === 'value' ? 'value' : null;
          if (!surface || !slotId || !sendPath || !role) return null;
          if (allowedSendPaths.size > 0 && !allowedSendPaths.has(sendPath)) return null;
          const valueKind =
            typeof r.valueKind === 'string' && r.valueKind.trim() ? r.valueKind.trim() : undefined;
          const toolName = typeof r.toolName === 'string' && r.toolName.trim() ? r.toolName.trim() : undefined;
          return {
            surface,
            slotId,
            role,
            sendPath,
            ...(valueKind ? { valueKind } : {}),
            ...(toolName ? { toolName } : {}),
          };
        })
        .filter(Boolean)
    : [];

  return { lexicon_mappings, backend_bindings, token_bindings, slot_contracts, send_hints };
}

async function proposeCompileSlotMappings(params) {
  const {
    surfaces = [],
    phraseTokens = [],
    receivePaths = [],
    receiveParamLeaves = [],
    backendTaskId = '',
    backendToolContexts = [],
    sendParamLeaves = [],
    outputLanguage,
    provider,
    model,
    aiProviderService,
    purpose,
    taskId,
    taskLabel,
  } = params;

  const uniqueSurfaces = [...new Set(surfaces.map(normalizeSurface).filter(Boolean))];
  const uniqueTokens = [...new Set(phraseTokens.map((t) => String(t).trim().toLowerCase()).filter(Boolean))];
  if (uniqueSurfaces.length === 0 && uniqueTokens.length === 0 && receivePaths.length === 0) {
    return {
      lexicon_mappings: [],
      backend_bindings: [],
      token_bindings: [],
      slot_contracts: [],
      send_hints: [],
    };
  }

  const allowedReceive = [
    ...new Set(
      [
        ...(Array.isArray(receivePaths) ? receivePaths : []),
        ...(Array.isArray(receiveParamLeaves) ? receiveParamLeaves.map((l) => l?.path) : []),
      ]
        .map((p) => String(p ?? '').trim())
        .filter(Boolean)
    ),
  ];

  const userMessage = buildUserMessage({
    surfaces: uniqueSurfaces,
    phraseTokens: uniqueTokens,
    receivePaths: allowedReceive,
    receiveParamLeaves,
    backendTaskId,
    backendToolContexts,
    sendParamLeaves,
  });

  const response = await aiProviderService.callAI(
    provider,
    [
      { role: 'system', content: COMPILE_SLOT_MAPPING_SYSTEM },
      {
        role: 'user',
        content:
          (outputLanguage ? `OUTPUT_LANGUAGE: ${outputLanguage}\n\n` : '') + userMessage,
      },
    ],
    {
      model: model || undefined,
      purpose: purpose || 'USE_CASE_COMPILE_SLOT_MAPPING',
      taskId,
      taskLabel,
      timeout: TIMEOUT_MS,
    }
  );

  const content = response?.choices?.[0]?.message?.content;
  const jsonStr = extractJsonString(content);
  const parsed = JSON.parse(jsonStr);
  return parseProposal(parsed, sendParamLeaves, allowedReceive);
}

module.exports = { proposeCompileSlotMappings };
