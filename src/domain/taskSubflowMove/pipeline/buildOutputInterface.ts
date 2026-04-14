/**
 * Canonical step: merge child flow OUTPUT interface rows for task variables (stable GUIDs).
 */

import { uniqueWireKeyFromLabel } from '@components/FlowMappingPanel/flowInterfaceDragTypes';
import { createFlowInterfaceMappingEntry } from '@components/FlowMappingPanel/mappingTypes';
import type { WorkspaceState } from '@flows/FlowTypes';
import { stripLegacyVariablesFromFlowMeta } from '../../../flows/flowMetaSanitize';
import type { VariableInstance } from '@types/variableTypes';
import { getProjectTranslationsTable } from '@utils/projectTranslationsRegistry';
import { leafLabelForNewInterfaceOutputRow } from '@utils/resolveVariableDisplayName';
import { isUuidString, makeTranslationKey } from '@utils/translationKeys';
import { logTaskSubflowMove } from '@utils/taskSubflowMoveDebug';
import { logS2Diag } from '@utils/s2WiringDiagnostic';

export type BuildOutputInterfaceInput = {
  flows: WorkspaceState['flows'];
  childFlowId: string;
  variables: VariableInstance[];
  onlyVarIds?: ReadonlySet<string>;
  projectId?: string;
  /** Used with compiled project translations to resolve labels when the child canvas slice is still empty. */
  parentFlowId?: string;
};

export type BuildOutputInterfaceOutput = WorkspaceState['flows'];

/**
 * Merges MappingEntry rows into the child flow's interface output for each task variable (stable GUID).
 * Re-exported as {@link mergeChildFlowInterfaceOutputsForVariables} for existing tests.
 */
export function BuildOutputInterface(input: BuildOutputInterfaceInput): BuildOutputInterfaceOutput {
  return mergeChildFlowInterfaceOutputsForVariables(input.flows, input.childFlowId, input.variables, {
    onlyVarIds: input.onlyVarIds,
    projectId: input.projectId,
    parentFlowId: input.parentFlowId,
  });
}

export function mergeChildFlowInterfaceOutputsForVariables(
  flows: WorkspaceState['flows'],
  childFlowId: string,
  variables: VariableInstance[],
  options?: { onlyVarIds?: ReadonlySet<string>; projectId?: string; parentFlowId?: string }
): WorkspaceState['flows'] {
  const flow = flows[childFlowId];
  if (!flow) {
    logS2Diag('mergeChildInterfaceOutput', 'SKIP: child flow slice mancante in flows', { childFlowId });
    return flows;
  }
  if (variables.length === 0) {
    logS2Diag('mergeChildInterfaceOutput', 'WARNING: variables[] vuoto — nessuna riga OUTPUT aggiunta', {
      childFlowId,
    });
  }
  const only = options?.onlyVarIds;
  const vars =
    only === undefined
      ? variables
      : only.size > 0
        ? variables.filter((v) => only.has(String(v.id || '').trim()))
        : [];
  const meta = { ...(flow.meta || {}) } as {
    flowInterface?: { input?: unknown[]; output?: unknown[] };
    translations?: Record<string, string>;
  };
  const tr: Record<string, string> = {
    ...(typeof meta.translations === 'object' && meta.translations ? meta.translations : {}),
  };
  const fi = { ...(meta.flowInterface || {}) };
  const prev: unknown[] = Array.isArray(fi.output) ? [...fi.output] : [];
  const seen = new Set(
    prev.map((e) => String((e as { variableRefId?: string }).variableRefId || '').trim()).filter(Boolean)
  );

  const labelOpts = {
    parentFlowId: options?.parentFlowId,
    compiledProjectTranslations: getProjectTranslationsTable(),
  };

  for (const v of vars) {
    const vid = String(v.id || '').trim();
    if (!vid || seen.has(vid)) continue;
    const labelText = leafLabelForNewInterfaceOutputRow(vid, childFlowId, flows, tr, labelOpts);
    const wireKey = uniqueWireKeyFromLabel(
      labelText,
      prev.map((row) => {
        const r = row as { id?: string; wireKey?: string };
        return { id: String(r.id || ''), wireKey: String(r.wireKey || '') };
      }),
      ''
    );
    const labelKey = isUuidString(vid) ? makeTranslationKey('var', vid) : undefined;
    prev.push(
      createFlowInterfaceMappingEntry({
        variableRefId: vid,
        wireKey,
        ...(labelKey ? { labelKey } : {}),
      })
    );
    if (labelKey) {
      tr[labelKey] = labelText;
    }
    seen.add(vid);
    logTaskSubflowMove('merge:interfaceOutputRow', {
      childFlowId,
      variableRefId: vid,
      resolvedLabel: labelText,
      onlyVarIdsMode: only !== undefined,
    });
  }

  const nextFlow = {
    ...flow,
    meta: stripLegacyVariablesFromFlowMeta({
      ...meta,
      translations: tr,
      flowInterface: {
        input: Array.isArray(fi.input) ? fi.input : [],
        output: prev,
      },
    }) as (typeof flow)['meta'],
    hasLocalChanges: true,
  };
  return { ...flows, [childFlowId]: nextFlow };
}
