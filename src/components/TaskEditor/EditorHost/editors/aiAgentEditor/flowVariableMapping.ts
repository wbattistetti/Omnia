/**
 * Flow-scoped variable resolution and outputVariableMappings updates for AI Agent fields.
 */

import { variableCreationService } from '@services/VariableCreationService';

/**
 * Resolves an existing flow variable by display name or creates a manual flow variable.
 */
export function resolveOrCreateFlowVarId(
  projectId: string,
  flowCanvasId: string | undefined,
  displayName: string
): string {
  const t = displayName.trim();
  if (!t) return '';
  const existingId = variableCreationService.getVarIdByVarName(projectId, t, undefined, flowCanvasId);
  if (existingId) return existingId;
  const nv = variableCreationService.createManualVariable(projectId, t, {
    scope: 'flow',
    scopeFlowId: flowCanvasId,
  });
  return nv.varId;
}

export interface ImplementMappingsResult {
  next: Record<string, string>;
  errors: string[];
}

/**
 * Links each unmapped proposed field to a flow variable derived from its label.
 */
export function linkUnmappedProposedFields(
  projectId: string,
  flowCanvasId: string | undefined,
  previous: Record<string, string>,
  fields: Array<{ field_name: string; label: string }>
): ImplementMappingsResult {
  const next = { ...previous };
  const errors: string[] = [];
  for (const f of fields) {
    if (next[f.field_name]) continue;
    const label = (f.label || f.field_name).trim();
    if (!label) continue;
    try {
      const vid = resolveOrCreateFlowVarId(projectId, flowCanvasId, label);
      if (vid) {
        next[f.field_name] = vid;
      } else {
        errors.push(`Impossibile collegare: ${label}`);
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { next, errors };
}

/**
 * Updates mappings when the designer edits the human-readable label (field_name JSON key unchanged).
 */
export function nextMappingsAfterLabelBlur(
  projectId: string,
  flowCanvasId: string | undefined,
  previous: Record<string, string>,
  fieldName: string,
  labelTrimmed: string
): Record<string, string> {
  if (!labelTrimmed) {
    const cleared = { ...previous };
    delete cleared[fieldName];
    return cleared;
  }
  const varIdExisting = previous[fieldName];
  if (varIdExisting) {
    const renamed = variableCreationService.renameVariableByVarId(
      projectId,
      varIdExisting,
      labelTrimmed
    );
    if (renamed) {
      return previous;
    }
  }
  let vid = variableCreationService.getVarIdByVarName(
    projectId,
    labelTrimmed,
    undefined,
    flowCanvasId
  );
  if (!vid) {
    const nv = variableCreationService.createManualVariable(projectId, labelTrimmed, {
      scope: 'flow',
      scopeFlowId: flowCanvasId,
    });
    vid = nv.varId;
  }
  return { ...previous, [fieldName]: vid };
}
