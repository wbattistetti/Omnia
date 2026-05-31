/**
 * Catalogo design-time: destinazioni semantiche, SEND, RECEIVE (backend) per Slot Mapping e compile.
 */

import type { BackendSendSemanticRole } from '@domain/openApi/backendSendParamCatalog';
import { normalizeSurface } from '@domain/useCaseBundle/projectSlotLexicon';
import type { TokenSendRole } from './types';
import type { SurfaceSendHint } from './types';
import type { BackendSendLeavesGroup } from './collectBackendSendLeavesByTask';
import type { BackendReceiveLeavesGroup } from './collectBackendReceiveLeavesByTask';
import { SURFACE_SEND_RULES, type SurfaceSendRule } from './surfaceSendRules';
import { inferSlotIdFromApiPath } from './inferSlotIdFromApiPath';

export type ParameterDestinationKind = 'semantic' | 'send' | 'receive';

/** Voce selezionabile nella combo Slot Mapping (allowlist design-time). */
export type ParameterDestination = {
  destinationId: string;
  kind: ParameterDestinationKind;
  slotId: string;
  backendTaskId?: string;
  toolName?: string;
  sendPath?: string;
  receivePath?: string;
  role?: TokenSendRole;
  valueKind?: string;
  facetLabel?: string;
  description?: string;
};

const FACET_LABEL_BY_ROLE: Record<BackendSendSemanticRole, string> = {
  horizon_end: 'fine intervallo',
  horizon_start: 'inizio intervallo',
  constraint: 'vincolo',
  value: 'valore',
  other: 'parametro',
};

const VALUE_KINDS_FOR_DATE_FACET: readonly string[] = [
  'end_of_month',
  'start_of_month',
  'tomorrow',
  'day_after_tomorrow',
  'today',
  'specific_date',
  'specific_time',
];

function isDateLikePath(path: string): boolean {
  return /(date|time|horizon|constraint|month|day)/i.test(path);
}

function facetVariantsForLeaf(
  semanticRole: BackendSendSemanticRole,
  path: string
): Array<{ valueKind?: string; role: TokenSendRole }> {
  if (!isDateLikePath(path)) {
    return [{ role: semanticRole === 'constraint' ? 'constraint' : 'value' }];
  }
  if (semanticRole === 'horizon_end') {
    return [
      { valueKind: 'end_of_month', role: 'constraint' },
      { valueKind: 'specific_date', role: 'value' },
    ];
  }
  if (semanticRole === 'horizon_start') {
    return [
      { valueKind: 'tomorrow', role: 'value' },
      { valueKind: 'today', role: 'value' },
      { valueKind: 'start_of_month', role: 'constraint' },
      { valueKind: 'specific_date', role: 'value' },
    ];
  }
  if (semanticRole === 'constraint') {
    return [{ valueKind: 'end_of_month', role: 'constraint' }, { role: 'constraint' }];
  }
  return VALUE_KINDS_FOR_DATE_FACET.map((valueKind) => ({
    valueKind,
    role: valueKind === 'end_of_month' || valueKind === 'start_of_month' ? 'constraint' : 'value',
  }));
}

function buildDestinationId(parts: {
  kind: ParameterDestinationKind;
  backendTaskId?: string;
  sendPath?: string;
  receivePath?: string;
  valueKind?: string;
  role?: string;
  slotId?: string;
}): string {
  if (parts.kind === 'semantic') {
    return `semantic:${(parts.slotId ?? '').trim().toLowerCase()}`;
  }
  const path = parts.kind === 'receive' ? parts.receivePath : parts.sendPath;
  return [parts.kind, parts.backendTaskId ?? '', path ?? '', parts.valueKind ?? '', parts.role ?? ''].join(
    ':'
  );
}

function formatFacetLabel(
  semanticRole: BackendSendSemanticRole,
  valueKind?: string,
  role?: TokenSendRole
): string {
  const base = FACET_LABEL_BY_ROLE[semanticRole] ?? 'parametro';
  if (valueKind) return `${base} · ${valueKind}`;
  if (role === 'constraint') return `${base} · constraint`;
  return base;
}

function inferDefaultSlotIdForSendLeaf(
  semanticRole: BackendSendSemanticRole,
  path: string
): string {
  if (/(time|orario|hour)/i.test(path)) return 'orario';
  if (semanticRole === 'horizon_end' || semanticRole === 'horizon_start' || /horizon|constraint/i.test(path)) {
    return 'datarelativa';
  }
  if (/\bdate\b/i.test(path)) return 'data';
  return 'datarelativa';
}

/**
 * Costruisce il catalogo: semantico + SEND + RECEIVE dai backend collegati.
 */
export function buildParameterDestinationCatalog(
  sendGroups: readonly BackendSendLeavesGroup[],
  receiveGroups: readonly BackendReceiveLeavesGroup[] = [],
  extraSemanticSlotIds: readonly string[] = []
): ParameterDestination[] {
  const out: ParameterDestination[] = [];
  const seenSemantic = new Set<string>();
  const seenDest = new Set<string>();

  for (const slotId of extraSemanticSlotIds) {
    const id = slotId.trim().toLowerCase();
    if (!id || id === 'undefined' || seenSemantic.has(id)) continue;
    seenSemantic.add(id);
    out.push({
      destinationId: buildDestinationId({ kind: 'semantic', slotId: id }),
      kind: 'semantic',
      slotId: id,
    });
  }

  for (const group of sendGroups) {
    for (const leaf of group.leaves) {
      const variants = facetVariantsForLeaf(leaf.semanticRole, leaf.path);
      for (const v of variants) {
        const destinationId = buildDestinationId({
          kind: 'send',
          backendTaskId: group.backendTaskId,
          sendPath: leaf.path,
          valueKind: v.valueKind,
          role: v.role,
        });
        if (seenDest.has(destinationId)) continue;
        seenDest.add(destinationId);
        out.push({
          destinationId,
          kind: 'send',
          slotId: inferDefaultSlotIdForSendLeaf(leaf.semanticRole, leaf.path),
          backendTaskId: group.backendTaskId,
          toolName: group.toolName,
          sendPath: leaf.path,
          role: v.role,
          ...(v.valueKind ? { valueKind: v.valueKind } : {}),
          facetLabel: formatFacetLabel(leaf.semanticRole, v.valueKind, v.role),
        });
      }
    }
  }

  for (const group of receiveGroups) {
    for (const leaf of group.leaves) {
      const destinationId = buildDestinationId({
        kind: 'receive',
        backendTaskId: group.backendTaskId,
        receivePath: leaf.path,
      });
      if (seenDest.has(destinationId)) continue;
      seenDest.add(destinationId);
      const slotId =
        leaf.suggestedSlotId?.trim() ||
        inferSlotIdFromApiPath(leaf.path) ||
        'data';
      const seg = leaf.path.split(/[.[\]]/).filter(Boolean).pop() ?? leaf.path;
      out.push({
        destinationId,
        kind: 'receive',
        slotId,
        backendTaskId: group.backendTaskId,
        toolName: group.toolName,
        receivePath: leaf.path,
        facetLabel: `output · ${seg}`,
        ...(leaf.description ? { description: leaf.description } : {}),
      });
    }
  }

  return out.sort((a, b) => {
    const order = (k: ParameterDestinationKind) =>
      k === 'semantic' ? 0 : k === 'receive' ? 1 : 2;
    const oa = order(a.kind);
    const ob = order(b.kind);
    if (oa !== ob) return oa - ob;
    const toolA = a.toolName ?? '';
    const toolB = b.toolName ?? '';
    if (toolA !== toolB) return toolA.localeCompare(toolB);
    const pathA = a.sendPath ?? a.receivePath ?? a.slotId;
    const pathB = b.sendPath ?? b.receivePath ?? b.slotId;
    return pathA.localeCompare(pathB);
  });
}

export function destinationToSendHint(dest: ParameterDestination, surface: string): SurfaceSendHint | null {
  if (dest.kind !== 'send' || !dest.sendPath?.trim()) return null;
  return {
    surface: normalizeSurface(surface),
    slotId: dest.slotId,
    role: dest.role ?? 'value',
    sendPath: dest.sendPath.trim(),
    ...(dest.valueKind ? { valueKind: dest.valueKind } : {}),
    ...(dest.toolName ? { toolName: dest.toolName } : {}),
    ...(dest.backendTaskId ? { backendTaskId: dest.backendTaskId } : {}),
  };
}

export function findDestinationForReceivePath(
  catalog: readonly ParameterDestination[],
  receivePath: string,
  backendTaskId?: string
): ParameterDestination | undefined {
  const path = receivePath.trim();
  return catalog.find(
    (d) =>
      d.kind === 'receive' &&
      d.receivePath === path &&
      (!backendTaskId || (d.backendTaskId ?? '') === backendTaskId)
  );
}

export function findDestinationForSendHint(
  catalog: readonly ParameterDestination[],
  hint: Pick<SurfaceSendHint, 'backendTaskId' | 'sendPath' | 'valueKind' | 'role' | 'slotId'>
): ParameterDestination | undefined {
  const sendPath = hint.sendPath?.trim();
  if (!sendPath) {
    return catalog.find((d) => d.kind === 'semantic' && d.slotId === hint.slotId.trim().toLowerCase());
  }
  return catalog.find(
    (d) =>
      d.kind === 'send' &&
      d.sendPath === sendPath &&
      (d.backendTaskId ?? '') === (hint.backendTaskId ?? '') &&
      (d.valueKind ?? '') === (hint.valueKind ?? '') &&
      (d.role ?? 'value') === (hint.role ?? 'value')
  );
}

function matchRule(surface: string): SurfaceSendRule | undefined {
  const normalized = normalizeSurface(surface);
  for (const r of SURFACE_SEND_RULES) {
    if (r.pattern.test(normalized)) return r;
  }
  return undefined;
}

/** Proposta automatica surface → destinazione (SEND preferito per vincoli lessicali). */
export function proposeDestinationForSurface(
  surface: string,
  slotId: string,
  catalog: readonly ParameterDestination[]
): ParameterDestination | null {
  const rule = matchRule(surface);
  const effectiveSlot = (rule?.slotId ?? slotId).trim().toLowerCase();

  if (rule) {
    const sendCandidates = catalog.filter((d) => d.kind === 'send');
    const exact = sendCandidates.find(
      (d) =>
        d.slotId === effectiveSlot &&
        (d.valueKind ?? '') === (rule.valueKind ?? '') &&
        (d.role ?? 'value') === rule.role
    );
    if (exact) return exact;
    const byRole = sendCandidates.find(
      (d) =>
        d.slotId === effectiveSlot &&
        (d.role ?? 'value') === rule.role &&
        (!rule.valueKind || d.valueKind === rule.valueKind)
    );
    if (byRole) return byRole;
  }

  const semantic = catalog.find((d) => d.kind === 'semantic' && d.slotId === effectiveSlot);
  if (semantic && !rule) return semantic;

  if (rule) {
    const anySend = catalog.find((d) => d.kind === 'send' && d.slotId === effectiveSlot);
    if (anySend) return anySend;
  }

  const receiveMatch = catalog.find(
    (d) => d.kind === 'receive' && d.slotId === effectiveSlot
  );
  if (receiveMatch) return receiveMatch;

  return catalog.find((d) => d.kind === 'semantic' && d.slotId === effectiveSlot) ?? null;
}

export function proposeSendHintFromDestinationCatalog(
  surface: string,
  slotId: string,
  catalog: readonly ParameterDestination[]
): SurfaceSendHint | null {
  const dest = proposeDestinationForSurface(surface, slotId, catalog);
  if (!dest) return null;
  return destinationToSendHint(dest, surface);
}

export type ParameterDestinationBackendGroup = {
  backendTaskId: string;
  toolName: string;
  sendDestinations: ParameterDestination[];
  receiveDestinations: ParameterDestination[];
};

export function groupDestinationsByBackend(catalog: readonly ParameterDestination[]): {
  semantic: ParameterDestination[];
  backends: ParameterDestinationBackendGroup[];
} {
  const semantic: ParameterDestination[] = [];
  const byBackend = new Map<string, ParameterDestinationBackendGroup>();

  for (const d of catalog) {
    if (d.kind === 'semantic') {
      semantic.push(d);
      continue;
    }
    const bid = d.backendTaskId ?? '';
    if (!bid) continue;
    let g = byBackend.get(bid);
    if (!g) {
      g = {
        backendTaskId: bid,
        toolName: d.toolName ?? bid,
        sendDestinations: [],
        receiveDestinations: [],
      };
      byBackend.set(bid, g);
    }
    if (d.kind === 'receive') g.receiveDestinations.push(d);
    else if (d.kind === 'send') g.sendDestinations.push(d);
  }

  return {
    semantic,
    backends: [...byBackend.values()].sort((a, b) => a.toolName.localeCompare(b.toolName)),
  };
}
