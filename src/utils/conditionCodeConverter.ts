// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { ASTNode } from '../components/conditions/dsl/parser/AST';
import { variableCreationService } from '@services/VariableCreationService';
import { getActiveFlowCanvasId } from '../flows/activeFlowCanvas';
import { getSafeProjectId } from './safeProjectId';

/** Options for label ↔ stored-id bracket conversion (message DSL, conditions). */
export type BracketVariableMappingOptions = {
  /**
   * When several map keys share the same label (e.g. Subflow composite UUID + parent var id),
   * prefer this key on encode so storage stays canonical.
   */
  preferKeysForEncode?: Set<string>;
  /**
   * When [guid] is missing from the map (stale id), resolve a display label (e.g. from VariableCreationService).
   */
  resolveUnknownGuidToLabel?: (guid: string) => string | null;
};

const GUID_TOKEN_IN_BRACKET = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeBracketLabelKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function lastSegmentOfVarName(label: string): string {
  const parts = label.split('.').map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1]! : label.trim();
}

function pickPreferredGuid(
  pairs: Array<[string, string]>,
  options?: BracketVariableMappingOptions
): string | null {
  if (pairs.length === 0) return null;
  if (pairs.length === 1) return pairs[0]![0];
  if (options?.preferKeysForEncode?.size) {
    const preferred = pairs.find(([g]) => options.preferKeysForEncode!.has(g));
    if (preferred) return preferred[0];
  }
  return pairs[0]![0];
}

/**
 * Resolves a single [token] body to a variable GUID: exact varName, then case-insensitive full name,
 * then case-insensitive match on the last segment (e.g. dati.colore ↔ [colore]).
 */
export function resolveBracketLabelTokenToGuid(
  trimmed: string,
  variableMappings: Map<string, string>,
  options?: BracketVariableMappingOptions
): string | null {
  if (!trimmed) return null;
  if (GUID_TOKEN_IN_BRACKET.test(trimmed) && variableMappings.has(trimmed)) {
    return trimmed;
  }

  const exact: Array<[string, string]> = [];
  for (const [guid, label] of variableMappings.entries()) {
    if (label === trimmed) exact.push([guid, label]);
  }
  const exactPick = pickPreferredGuid(exact, options);
  if (exactPick) return exactPick;

  const nt = normalizeBracketLabelKey(trimmed);
  const normFull: Array<[string, string]> = [];
  for (const [guid, label] of variableMappings.entries()) {
    if (normalizeBracketLabelKey(label) === nt) normFull.push([guid, label]);
  }
  const normPick = pickPreferredGuid(normFull, options);
  if (normPick) return normPick;

  const bySeg: Array<[string, string]> = [];
  for (const [guid, label] of variableMappings.entries()) {
    if (normalizeBracketLabelKey(lastSegmentOfVarName(label)) === nt) {
      bySeg.push([guid, label]);
    }
  }
  return pickPreferredGuid(bySeg, options);
}

/**
 * ✅ FASE 2: Converts DSL with labels to DSL with GUIDs
 * readableCode: [dataNascita.giorno] == 15
 * executableCode: [guid-2222] == 15
 */
export function convertDSLLabelsToGUIDs(
  readableCode: string,
  variableMappings: Map<string, string>, // Map<guid, label>
  options?: BracketVariableMappingOptions
): string {
  if (!readableCode || typeof readableCode !== 'string') {
    return readableCode;
  }

  // Replace [label] with [guid] in DSL
  // Pattern matches [label] or [label.subpath] including Unicode characters (à, è, ì, etc.)
  // ✅ FIX: Use [^\[\]]+? to match any content except brackets (supports Unicode)
  return readableCode.replace(/\[\s*([^\[\]]+?)\s*\]/g, (match, label) => {
    const trimmed = String(label).trim();
    const guid = resolveBracketLabelTokenToGuid(trimmed, variableMappings, options);
    if (!guid) {
      console.warn(`[ConditionCodeConverter] Variable [${label}] not found in mappings`);
      return match;
    }
    return `[${guid}]`;
  });
}

/**
 * ✅ FASE 2: Converts DSL with GUIDs to DSL with labels
 * executableCode: [guid-2222] == 15
 * readableCode: [dataNascita.giorno] == 15
 * Used when loading condition for display in editor
 */
export function convertDSLGUIDsToLabels(
  executableCode: string,
  variableMappings: Map<string, string>, // Map<guid, label>
  options?: BracketVariableMappingOptions
): string {
  if (!executableCode || typeof executableCode !== 'string') {
    return executableCode;
  }

  // Replace [guid] with [label] in DSL
  // Pattern matches GUID format: [xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx]
  const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  return executableCode.replace(/\[\s*([^\]]+)\s*\]/g, (match, content) => {
    const trimmed = content.trim();

    // Check if content is a GUID
    if (GUID_PATTERN.test(trimmed)) {
      let label = variableMappings.get(trimmed);
      if (!label && options?.resolveUnknownGuidToLabel) {
        label = options.resolveUnknownGuidToLabel(trimmed) ?? undefined;
      }

      if (label) {
        return `[${label}]`;
      }
      console.warn(`[ConditionCodeConverter] GUID [${trimmed}] not found in mappings`);
      return match;
    }

    // Not a GUID, keep as is (might be a literal or other content)
    return match;
  });
}


/**
 * Transforms AST: replaces variable labels with GUIDs
 * Used when saving AST to database (runtime format)
 */
export async function transformASTLabelsToGuids(
  ast: ASTNode | null,
  variableMappingService: { getVariableId: (label: string, path?: string[]) => Promise<string | null> }
): Promise<ASTNode | null> {
  if (!ast) return ast;

  // If it's a variable node, convert label → GUID
  if (ast.type === 'variable') {
    const guid = await variableMappingService.getVariableId(ast.name, ast.path);
    if (guid) {
      return { ...ast, name: guid }; // Replace label with GUID
    }
    // If GUID not found, keep label (fallback)
    console.warn(`[ConditionCodeConverter] Variable "${ast.name}" not found in mappings, keeping label`);
    return ast;
  }

  // Recursively transform nested nodes
  const transformed: ASTNode = { ...ast };

  if ('left' in ast && ast.left) {
    transformed.left = await transformASTLabelsToGuids(ast.left, variableMappingService) as ASTNode;
  }
  if ('right' in ast && ast.right) {
    transformed.right = await transformASTLabelsToGuids(ast.right, variableMappingService) as ASTNode;
  }
  if ('operand' in ast && ast.operand) {
    transformed.operand = await transformASTLabelsToGuids(ast.operand, variableMappingService) as ASTNode;
  }
  if ('expression' in ast && ast.expression) {
    transformed.expression = await transformASTLabelsToGuids(ast.expression, variableMappingService) as ASTNode;
  }
  if ('args' in ast && ast.args) {
    transformed.args = await Promise.all(
      ast.args.map(arg => transformASTLabelsToGuids(arg, variableMappingService))
    ) as ASTNode[];
  }

  return transformed;
}

/**
 * Transforms AST: replaces GUIDs with variable labels
 * Used when loading AST from database for display in editor
 */
export function transformASTGuidsToLabels(
  ast: ASTNode | null,
  variableMappings: Map<string, string> // Map<guid, label>
): ASTNode | null {
  if (!ast) return ast;

  // If it's a variable node, convert GUID → label
  if (ast.type === 'variable') {
    const label = variableMappings.get(ast.name);
    if (label) {
      return { ...ast, name: label }; // Replace GUID with label
    }
    // If label not found, keep GUID (fallback)
    console.warn(`[ConditionCodeConverter] GUID "${ast.name}" not found in mappings, keeping GUID`);
    return ast;
  }

  // Recursively transform nested nodes
  const transformed: ASTNode = { ...ast };

  if ('left' in ast && ast.left) {
    transformed.left = transformASTGuidsToLabels(ast.left, variableMappings) as ASTNode;
  }
  if ('right' in ast && ast.right) {
    transformed.right = transformASTGuidsToLabels(ast.right, variableMappings) as ASTNode;
  }
  if ('operand' in ast && ast.operand) {
    transformed.operand = transformASTGuidsToLabels(ast.operand, variableMappings) as ASTNode;
  }
  if ('expression' in ast && ast.expression) {
    transformed.expression = transformASTGuidsToLabels(ast.expression, variableMappings) as ASTNode;
  }
  if ('args' in ast && ast.args) {
    transformed.args = ast.args.map(arg => transformASTGuidsToLabels(arg, variableMappings)) as ASTNode[];
  }

  return transformed;
}

/**
 * Creates a complete Map<variableGuid, varName> from VariableInstance rows visible on the given flow canvas.
 * Primary key is id (GUID = TaskTreeNode.id for task-bound rows).
 */
export function createVariableMappings(flowCanvasId?: string): Map<string, string> {
  const mappings = new Map<string, string>();

  try {
    const projectId = getSafeProjectId();
    const fid = flowCanvasId ?? getActiveFlowCanvasId();
    const instances = variableCreationService.getVariablesForFlowScope(projectId, fid) ?? [];
    for (const v of instances) {
      const vid = typeof v.id === 'string' ? v.id.trim() : '';
      if (!vid) continue;
      const varName = typeof v.varName === 'string' ? v.varName.trim() : '';
      if (!varName) continue;
      mappings.set(vid, varName);
    }
  } catch (error) {
    console.warn('[ConditionCodeConverter] Could not load variable mappings', error);
  }

  return mappings;
}
