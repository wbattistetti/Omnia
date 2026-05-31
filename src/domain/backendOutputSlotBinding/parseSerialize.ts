/**
 * Parse/serialize `AgentBackendOutputSlotBindings` su `Task.agentBackendOutputSlotBindingsJson`.
 */

import {
  BACKEND_OUTPUT_SLOT_BINDING_SCHEMA_VERSION,
  type AgentBackendOutputSlotBindings,
  type BackendOutputSlotBindingRow,
  type SlotBackendContract,
  type SurfaceSendHint,
  type TokenSendRole,
} from './types';

export function emptyAgentBackendOutputSlotBindings(): AgentBackendOutputSlotBindings {
  return {
    schemaVersion: BACKEND_OUTPUT_SLOT_BINDING_SCHEMA_VERSION,
    rows: [],
    slotContracts: [],
  };
}

function normalizeSlotContract(raw: unknown): SlotBackendContract | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const slotId = String(o.slotId ?? '').trim().toLowerCase();
  const toolName = String(o.toolName ?? '').trim();
  const backendTaskId = String(o.backendTaskId ?? '').trim();
  const receive = String(o.receive ?? '').trim();
  if (!slotId || !receive) return null;
  const sendRaw = o.send ?? o.sendParams;
  const send = Array.isArray(sendRaw)
    ? sendRaw.map((s) => String(s).trim()).filter(Boolean)
    : undefined;
  const format = typeof o.format === 'string' && o.format.trim() ? o.format.trim() : undefined;
  const approved = o.approved === true;
  return {
    slotId,
    toolName,
    backendTaskId,
    receive,
    ...(send?.length ? { send } : {}),
    ...(format ? { format } : {}),
    ...(approved ? { approved: true } : {}),
  };
}

function normalizeTokenSendRole(raw: unknown): TokenSendRole | undefined {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'value' || s === 'constraint') return s;
  return undefined;
}

function normalizeSendHint(raw: unknown): SurfaceSendHint | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const surface = String(o.surface ?? '').trim().toLowerCase();
  const slotId = String(o.slotId ?? '').trim().toLowerCase();
  const sendPath = String(o.sendPath ?? '').trim();
  const role = normalizeTokenSendRole(o.role);
  if (!surface || !slotId || !sendPath || !role) return null;
  const valueKind =
    typeof o.valueKind === 'string' && o.valueKind.trim() ? o.valueKind.trim() : undefined;
  const toolName = typeof o.toolName === 'string' && o.toolName.trim() ? o.toolName.trim() : undefined;
  const backendTaskId =
    typeof o.backendTaskId === 'string' && o.backendTaskId.trim()
      ? o.backendTaskId.trim()
      : undefined;
  const approved = o.approved === true;
  return {
    surface,
    slotId,
    role,
    sendPath,
    ...(valueKind ? { valueKind } : {}),
    ...(toolName ? { toolName } : {}),
    ...(backendTaskId ? { backendTaskId } : {}),
    ...(approved ? { approved: true } : {}),
  };
}

function normalizeRow(raw: unknown): BackendOutputSlotBindingRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const backendTaskId = String(o.backendTaskId ?? '').trim();
  const apiPath = String(o.apiPath ?? '').trim();
  const slotId = String(o.slotId ?? '').trim().toLowerCase();
  const tokenInPhrase = String(o.tokenInPhrase ?? o.token ?? '').trim().toLowerCase();
  if (!backendTaskId || !apiPath || !slotId || !tokenInPhrase) return null;
  const format = typeof o.format === 'string' && o.format.trim() ? o.format.trim() : undefined;
  const approved = o.approved === true;
  return { backendTaskId, apiPath, slotId, tokenInPhrase, ...(format ? { format } : {}), ...(approved ? { approved: true } : {}) };
}

export function parseAgentBackendOutputSlotBindingsJson(
  raw: string | null | undefined
): AgentBackendOutputSlotBindings {
  if (!raw || !String(raw).trim()) return emptyAgentBackendOutputSlotBindings();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return emptyAgentBackendOutputSlotBindings();
    const o = parsed as Record<string, unknown>;
    const rowsRaw = Array.isArray(o.rows) ? o.rows : [];
    const rows = rowsRaw.map(normalizeRow).filter((r): r is BackendOutputSlotBindingRow => r != null);
    const contractsRaw = Array.isArray(o.slotContracts) ? o.slotContracts : [];
    const slotContracts = contractsRaw
      .map(normalizeSlotContract)
      .filter((c): c is SlotBackendContract => c != null);
    const hintsRaw = Array.isArray(o.sendHints) ? o.sendHints : [];
    const sendHints = hintsRaw
      .map(normalizeSendHint)
      .filter((h): h is SurfaceSendHint => h != null);
    const sourceFingerprint =
      typeof o.sourceFingerprint === 'string' && o.sourceFingerprint.trim()
        ? o.sourceFingerprint.trim()
        : undefined;
    return {
      schemaVersion: BACKEND_OUTPUT_SLOT_BINDING_SCHEMA_VERSION,
      rows,
      slotContracts,
      ...(sendHints.length > 0 ? { sendHints } : {}),
      ...(sourceFingerprint ? { sourceFingerprint } : {}),
    };
  } catch {
    return emptyAgentBackendOutputSlotBindings();
  }
}

export function serializeAgentBackendOutputSlotBindings(
  bindings: AgentBackendOutputSlotBindings
): string {
  return JSON.stringify({
    schemaVersion: BACKEND_OUTPUT_SLOT_BINDING_SCHEMA_VERSION,
    rows: bindings.rows,
    slotContracts: bindings.slotContracts ?? [],
    ...(bindings.sendHints?.length ? { sendHints: bindings.sendHints } : {}),
    ...(bindings.sourceFingerprint ? { sourceFingerprint: bindings.sourceFingerprint } : {}),
  });
}
