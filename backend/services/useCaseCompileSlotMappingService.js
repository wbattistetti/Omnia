/**
 * Proposta IA mapping compile: dizionario slot dinamico + binding backend/KB/dialogo.
 */

const { extractJsonString } = require('./AIAgentDesignService');
const { COMPILE_SLOT_MAPPING_SYSTEM } = require('./useCaseCompileSlotMappingPrompts');

const TIMEOUT_MS = Number.parseInt(process.env.USE_CASE_COMPILE_SLOT_MAPPING_TIMEOUT_MS || '120000', 10);

const VALID_VALUE_TYPES = new Set([
  'string',
  'date',
  'time',
  'enum',
  'number',
  'boolean',
  'list',
  'unknown',
]);

function normalizeSurface(s) {
  return String(s ?? '').trim().toLowerCase();
}

function isValidSlotId(s) {
  return /^[a-z][a-z0-9_]*$/.test(s) && !s.includes('__') && s !== 'undefined' && s !== 'slot';
}

function normalizeProposalSlotId(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!isValidSlotId(s)) return null;
  return s;
}

function parseBinding(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = raw.kind;
  if (kind === 'dialog' && typeof raw.path === 'string' && raw.path.trim()) {
    return { kind: 'dialog', path: raw.path.trim() };
  }
  if (kind === 'kb' && typeof raw.path === 'string' && raw.path.trim()) {
    return { kind: 'kb', path: raw.path.trim() };
  }
  if (kind === 'backend_receive' && typeof raw.apiPath === 'string' && raw.apiPath.trim()) {
    return {
      kind: 'backend_receive',
      apiPath: raw.apiPath.trim(),
      ...(typeof raw.toolName === 'string' && raw.toolName.trim()
        ? { toolName: raw.toolName.trim() }
        : {}),
    };
  }
  if (kind === 'backend_send' && typeof raw.sendPath === 'string' && raw.sendPath.trim()) {
    return {
      kind: 'backend_send',
      sendPath: raw.sendPath.trim(),
      ...(typeof raw.toolName === 'string' && raw.toolName.trim()
        ? { toolName: raw.toolName.trim() }
        : {}),
    };
  }
  if (kind === 'unbound') return { kind: 'unbound' };
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
  const hasBackend = tools.length > 0 || receivePaths.length > 0;

  return `No predefined slot vocabulary. Invent slot_ids for this task only.

Surfaces (literal [inner] text from phrases):
${JSON.stringify(surfaces.slice(0, 80))}

Phrase tokens (compiled token names in agent templates):
${JSON.stringify(tokens.slice(0, 80))}

Backend tools (exact toolName; receivePathTree — omit binding if empty):
${JSON.stringify(tools.slice(0, 20), null, 0)}

Flat RECEIVE api paths (backendTaskId="${String(backendTaskId || '').trim()}"):
${JSON.stringify(receivePaths.slice(0, 120))}

RECEIVE param leaves:
${JSON.stringify(receiveLeaves.slice(0, 96))}

SEND param leaves:
${JSON.stringify(leaves.slice(0, 80))}

Return JSON:
{
  "slot_definitions": [
    {
      "slotId": "medico_richiesto",
      "label": "Medico richiesto",
      "valueType": "string",
      "description": "Nome del medico nominato dal paziente",
      "binding": { "kind": "dialog", "path": "dialog.medico_scelto" }
    }
  ],
  "lexicon_mappings": [ { "surface": "medico_richiesto", "slot_id": "medico_richiesto" } ],
  "token_bindings": [],
  "backend_bindings": [],
  "slot_contracts": [],
  "send_hints": []
}
REQUIRED:
- slot_definitions for every slot_id you use
- lexicon_mappings must cover EVERY surface and phrase_token listed
- ${hasBackend ? 'Use RECEIVE/SEND paths only from lists above when binding backend.' : 'No backend: use kb or dialog bindings only; leave token_bindings/backend_bindings empty unless paths exist.'}
Valid JSON only.`;
}

function parseProposal(parsed, sendParamLeaves, allowedReceivePaths) {
  const receiveSet = new Set(
    (Array.isArray(allowedReceivePaths) ? allowedReceivePaths : [])
      .map((p) => String(p).trim())
      .filter(Boolean)
  );

  const slot_definitions = Array.isArray(parsed.slot_definitions)
    ? parsed.slot_definitions
        .map((r) => {
          if (!r || typeof r !== 'object') return null;
          const slotId = normalizeProposalSlotId(r.slotId ?? r.slot_id);
          if (!slotId) return null;
          const valueType =
            typeof r.valueType === 'string' && VALID_VALUE_TYPES.has(r.valueType.trim())
              ? r.valueType.trim()
              : 'unknown';
          const description =
            typeof r.description === 'string' ? r.description.trim() : '';
          const binding = parseBinding(r.binding) ?? { kind: 'unbound' };
          const label = typeof r.label === 'string' && r.label.trim() ? r.label.trim() : slotId;
          return {
            slotId,
            label,
            valueType,
            description,
            binding,
          };
        })
        .filter(Boolean)
    : [];

  const lexicon_mappings = Array.isArray(parsed.lexicon_mappings)
    ? parsed.lexicon_mappings
        .map((r) => {
          if (!r || typeof r !== 'object') return null;
          const surface = normalizeSurface(r.surface);
          const slot_id = normalizeProposalSlotId(r.slot_id ?? r.slotId);
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

  return {
    slot_definitions,
    lexicon_mappings,
    backend_bindings,
    token_bindings,
    slot_contracts,
    send_hints,
  };
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
      slot_definitions: [],
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
