/**
 * Applica la proposta IA compile a lessico e tabella binding backend.
 */

import type { SlotSurfaceMapping } from '@domain/useCaseBundle/schema';
import { mergeMappingsIntoLexicon, type ProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';
import {
  mergeSlotDefinitionsIntoLexicon,
  type DynamicSlotBindingSource,
  type DynamicSlotValueType,
} from '@domain/useCaseBundle/dynamicSlotRegistry';
import type {
  AgentBackendOutputSlotBindings,
  BackendOutputSlotBindingRow,
  SurfaceSendHint,
  TokenSendRole,
} from './types';
import { BACKEND_OUTPUT_SLOT_BINDING_SCHEMA_VERSION } from './types';
import { mergeSlotContractsFromProposal } from './slotBackendContract';
import { mergeSendHintsIntoBindings } from './mergeSendHints';
import type { BackendSendParamLeaf } from '@domain/openApi/backendSendParamCatalog';
import { isSendPathAllowed } from './surfaceSendHints';
import { normalizeProposalSlotId } from './resolveCanonicalSlotId';

export interface CompileSlotMappingProposal {
  slot_definitions?: Array<{
    slotId: string;
    label?: string;
    valueType?: DynamicSlotValueType;
    description?: string;
    binding?: DynamicSlotBindingSource;
  }>;
  lexicon_mappings: Array<{ surface: string; slot_id: string }>;
  backend_bindings: Array<{
    apiPath: string;
    slotId: string;
    tokenInPhrase: string;
    format?: string;
  }>;
  /** Legame esplicito token compilato → path RECEIVE (prioritario in runtime). */
  token_bindings?: Array<{
    token: string;
    apiPath: string;
    slotId: string;
    format?: string;
  }>;
  slot_contracts?: Array<{
    slotId: string;
    toolName: string;
    receive: string;
    send?: string[];
    format?: string;
    backendTaskId?: string;
  }>;
  send_hints?: Array<{
    surface: string;
    slotId: string;
    role: TokenSendRole;
    sendPath: string;
    valueKind?: string;
    toolName?: string;
  }>;
}

function normalizeProposalSendHints(
  raw: CompileSlotMappingProposal['send_hints'],
  leaves: readonly BackendSendParamLeaf[]
): SurfaceSendHint[] {
  if (!Array.isArray(raw)) return [];
  const out: SurfaceSendHint[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const surface = String(r.surface ?? '').trim().toLowerCase();
    const slotId = String(r.slotId ?? '').trim().toLowerCase();
    const sendPath = String(r.sendPath ?? '').trim();
    const role = r.role === 'constraint' ? 'constraint' : r.role === 'value' ? 'value' : null;
    if (!surface || !slotId || !sendPath || !role) continue;
    if (!isSendPathAllowed(sendPath, leaves)) continue;
    const valueKind =
      typeof r.valueKind === 'string' && r.valueKind.trim() ? r.valueKind.trim() : undefined;
    const toolName = typeof r.toolName === 'string' && r.toolName.trim() ? r.toolName.trim() : undefined;
    out.push({
      surface,
      slotId,
      role,
      sendPath,
      ...(valueKind ? { valueKind } : {}),
      ...(toolName ? { toolName } : {}),
    });
  }
  return out;
}

export function collectSurfacesFromMappings(
  mappings: readonly SlotSurfaceMapping[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of mappings) {
    const s = m.surface.trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function applyCompileSlotMappingProposal(
  lexicon: ProjectSlotLexicon,
  bindings: AgentBackendOutputSlotBindings,
  proposal: CompileSlotMappingProposal,
  options: {
    backendTaskId: string;
    sourceTaskId?: string;
    sendLeaves?: readonly BackendSendParamLeaf[];
  }
): {
  lexicon: ProjectSlotLexicon;
  bindings: AgentBackendOutputSlotBindings;
} {
  const slotMappings: SlotSurfaceMapping[] = proposal.lexicon_mappings.map((m) => ({
    surface: m.surface,
    slot_id: m.slot_id,
  }));
  const seenSurfaces = new Set(slotMappings.map((m) => m.surface.trim().toLowerCase()));
  for (const tb of proposal.token_bindings ?? []) {
    const surface = String(tb.token ?? '').trim().toLowerCase();
    const slot_id = normalizeProposalSlotId(tb.slotId) ?? '';
    if (!surface || !slot_id || seenSurfaces.has(surface)) continue;
    seenSurfaces.add(surface);
    slotMappings.push({ surface, slot_id });
  }
  let workingLexicon = lexicon;
  if (proposal.slot_definitions?.length) {
    workingLexicon = mergeSlotDefinitionsIntoLexicon(
      workingLexicon,
      proposal.slot_definitions.map((d) => ({
        slotId: d.slotId,
        label: d.label,
        valueType: d.valueType,
        description: d.description,
        binding: d.binding,
        proposedByAi: true,
      })),
      { overwriteProposedOnly: true }
    );
  }

  const { lexicon: mergedLexicon } = mergeMappingsIntoLexicon(workingLexicon, slotMappings, {
    sourceTaskId: options.sourceTaskId,
    upgradeUnclassified: true,
    approveClassifiedProposals: true,
  });

  const byPath = new Map<string, BackendOutputSlotBindingRow>();
  for (const row of bindings.rows) {
    byPath.set(`${row.backendTaskId}::${row.apiPath}`, row);
  }
  const backendTaskId = options.backendTaskId.trim();

  const upsertBindingRow = (b: {
    apiPath: string;
    slotId: string;
    tokenInPhrase: string;
    format?: string;
  }): void => {
    const slotId = normalizeProposalSlotId(b.slotId) ?? b.slotId.trim().toLowerCase();
    const apiPath = b.apiPath.trim();
    if (!apiPath || !slotId) return;
    const key = `${backendTaskId}::${apiPath}`;
    const prev = byPath.get(key);
    if (prev?.approved) return;
    byPath.set(key, {
      backendTaskId,
      apiPath,
      slotId,
      tokenInPhrase: b.tokenInPhrase.trim().toLowerCase() || slotId,
      ...(b.format ? { format: b.format } : {}),
      approved: prev?.approved,
    });
  };

  for (const b of proposal.backend_bindings) {
    upsertBindingRow(b);
  }

  for (const tb of proposal.token_bindings ?? []) {
    const slotId = normalizeProposalSlotId(tb.slotId) ?? '';
    if (!slotId) continue;
    upsertBindingRow({
      apiPath: tb.apiPath,
      slotId,
      tokenInPhrase: tb.token,
      ...(tb.format ? { format: tb.format } : {}),
    });
  }

  const rows = [...byPath.values()];
  const slotContracts = mergeSlotContractsFromProposal(
    bindings.slotContracts ?? [],
    proposal.slot_contracts ?? [],
    backendTaskId
  );

  let mergedBindings: AgentBackendOutputSlotBindings = {
    schemaVersion: BACKEND_OUTPUT_SLOT_BINDING_SCHEMA_VERSION,
    rows,
    slotContracts,
    sendHints: bindings.sendHints,
    sourceFingerprint: bindings.sourceFingerprint,
  };

  const leaves = options.sendLeaves ?? [];
  const iaHints = normalizeProposalSendHints(proposal.send_hints, leaves);
  if (iaHints.length > 0 && leaves.length > 0) {
    mergedBindings = mergeSendHintsIntoBindings(mergedBindings, iaHints, leaves);
  }

  return {
    lexicon: mergedLexicon,
    bindings: mergedBindings,
  };
}
