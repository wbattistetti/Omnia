/**
 * Canonical step: populate child flow INPUT interface from external VarIds (InterfaceInputVars domain).
 */

import { uniqueWireKeyFromLabel } from '@components/FlowMappingPanel/flowInterfaceDragTypes';
import { createFlowInterfaceMappingEntry } from '@components/FlowMappingPanel/mappingTypes';
import type { VarId } from '@domain/guidModel/types';
import { labelKey } from '@domain/guidModel/labelKey';
import type { WorkspaceState } from '@flows/FlowTypes';
import { stripLegacyVariablesFromFlowMeta } from '../../../flows/flowMetaSanitize';
import { getProjectTranslationsTable } from '@utils/projectTranslationsRegistry';
import { leafLabelForNewInterfaceOutputRow } from '@utils/resolveVariableDisplayName';
import { isUuidString } from '@utils/translationKeys';
import { logS2Diag } from '@utils/s2WiringDiagnostic';

export type BuildInputInterfaceInput = {
  flows: WorkspaceState['flows'];
  projectId: string;
  childFlowId: string;
  interfaceInputVars: readonly VarId[];
  /** Same-task row text on parent when child canvas is empty in the snapshot. */
  parentFlowId?: string;
};

export type BuildInputInterfaceOutput = WorkspaceState['flows'];

export function BuildInputInterface(input: BuildInputInterfaceInput): BuildInputInterfaceOutput {
  return mergeChildFlowInterfaceInputsFromInterfaceInputVars(
    input.flows,
    input.projectId,
    input.childFlowId,
    input.interfaceInputVars,
    { parentFlowId: input.parentFlowId }
  );
}

export function mergeChildFlowInterfaceInputsFromInterfaceInputVars(
  flows: WorkspaceState['flows'],
  projectId: string,
  childFlowId: string,
  interfaceInputVars: readonly VarId[],
  options?: { parentFlowId?: string }
): WorkspaceState['flows'] {
  const pid = String(projectId || '').trim();
  const cid = String(childFlowId || '').trim();
  if (!pid || !cid) return flows;

  const flow = flows[cid];
  if (!flow) {
    logS2Diag('mergeChildInterfaceInput', 'SKIP: child flow slice mancante', { childFlowId: cid });
    return flows;
  }

  const meta = { ...(flow.meta || {}) } as {
    flowInterface?: { input?: unknown[]; output?: unknown[] };
    translations?: Record<string, string>;
  };
  const fi = { ...(meta.flowInterface || {}) };
  const prevOut = Array.isArray(fi.output) ? [...fi.output] : [];
  const tr: Record<string, string> = {
    ...(typeof meta.translations === 'object' && meta.translations ? meta.translations : {}),
  };
  const prevIn: unknown[] = [];
  const seen = new Set<string>();

  const labelOpts = {
    parentFlowId: options?.parentFlowId,
    compiledProjectTranslations: getProjectTranslationsTable(),
  };

  for (const vidRaw of interfaceInputVars) {
    const vid = String(vidRaw || '').trim();
    if (!vid || seen.has(vid)) continue;
    seen.add(vid);

    const labelText = leafLabelForNewInterfaceOutputRow(vid, cid, flows, tr, labelOpts);
    const wireKey = uniqueWireKeyFromLabel(
      labelText,
      prevIn.map((row) => {
        const r = row as { id?: string; wireKey?: string };
        return { id: String(r.id || ''), wireKey: String(r.wireKey || '') };
      }),
      ''
    );
    const labelKeyStr = isUuidString(vid) ? labelKey(vid as VarId) : undefined;
    prevIn.push(
      createFlowInterfaceMappingEntry({
        variableRefId: vid,
        wireKey,
        ...(labelKeyStr ? { labelKey: labelKeyStr } : {}),
      })
    );
    if (labelKeyStr) {
      tr[labelKeyStr] = labelText;
    }
  }

  const nextFlow = {
    ...flow,
    meta: stripLegacyVariablesFromFlowMeta({
      ...meta,
      translations: tr,
      flowInterface: {
        input: prevIn,
        output: prevOut,
      },
    }) as (typeof flow)['meta'],
    hasLocalChanges: true,
  };
  return { ...flows, [cid]: nextFlow };
}
