// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

// Utility to convert between readable labels and varIds in condition scripts.
// varId is the stable identifier stored in condition expressions.
// varName is the human-readable label displayed in the editor.

import { variableCreationService } from '../services/VariableCreationService';
import { getActiveFlowCanvasId } from '../flows/activeFlowCanvas';

/** UUID pattern used to detect varIds in scripts. */
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Patterns matching ctx["key"] and getVar(ctx, "key") */
const CTX_PATTERN = /ctx\s*\[\s*(["'`])([^"'`]+)\1\s*\]/g;
const GET_VAR_PATTERN = /getVar\s*\(\s*ctx\s*,\s*(["'`])([^"'`]+)\1\s*\)/g;

function getProjectId(): string | null {
  try {
    return localStorage.getItem('currentProjectId');
  } catch {
    return null;
  }
}

/**
 * Convert varName (label) → varId (GUID) in a condition script.
 * e.g. ctx["data di nascita"] → ctx["<varId>"]
 *
 * Called before saving a condition to the database.
 */
export function convertScriptLabelsToGuids(script: string): string {
  if (!script || typeof script !== 'string') return script;

  const projectId = getProjectId();
  if (!projectId) return script;

  const replaceLabel = (match: string, quote: string, label: string, isGetVar: boolean): string => {
    const varId = variableCreationService.getVarIdByVarName(projectId, label, undefined, getActiveFlowCanvasId());
    if (varId) {
      return isGetVar
        ? `getVar(ctx, ${quote}${varId}${quote})`
        : `ctx[${quote}${varId}${quote}]`;
    }
    console.warn('[ConditionScriptConverter][LABEL→GUID] No varId found for label', { label });
    return match;
  };

  let converted = script;
  converted = converted.replace(CTX_PATTERN, (m, q, label) => replaceLabel(m, q, label, false));
  converted = converted.replace(GET_VAR_PATTERN, (m, q, label) => replaceLabel(m, q, label, true));
  return converted;
}

/**
 * Convert varId (GUID) → varName (label) in a condition script.
 * e.g. ctx["<varId>"] → ctx["data di nascita"]
 *
 * Called when loading a condition from the database for display in the editor.
 */
export function convertScriptGuidsToLabels(script: string): string {
  if (!script || typeof script !== 'string') return script;

  const projectId = getProjectId();
  if (!projectId) return script;

  const replaceGuid = (match: string, quote: string, key: string, isGetVar: boolean): string => {
    if (!GUID_PATTERN.test(key)) return match;

    const varName = variableCreationService.getVarNameByVarId(projectId, key);
    if (varName) {
      return isGetVar
        ? `getVar(ctx, ${quote}${varName}${quote})`
        : `ctx[${quote}${varName}${quote}]`;
    }
    console.warn('[ConditionScriptConverter][GUID→LABEL] No varName found for varId', { varId: key });
    return match;
  };

  let converted = script;
  converted = converted.replace(CTX_PATTERN, (m, q, key) => replaceGuid(m, q, key, false));
  converted = converted.replace(GET_VAR_PATTERN, (m, q, key) => replaceGuid(m, q, key, true));
  return converted;
}
