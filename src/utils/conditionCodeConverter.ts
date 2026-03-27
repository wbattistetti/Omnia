// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { ASTNode } from '../components/conditions/dsl/parser/AST';
import { variableCreationService } from '@services/VariableCreationService';
import { getActiveFlowCanvasId } from '../flows/activeFlowCanvas';

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
    const matches = Array.from(variableMappings.entries()).filter(([, l]) => l === trimmed);

    if (matches.length === 0) {
      console.warn(`[ConditionCodeConverter] Variable [${label}] not found in mappings`);
      return match;
    }

    let chosen = matches[0]!;
    if (matches.length > 1 && options?.preferKeysForEncode?.size) {
      const preferred = matches.find(([g]) => options.preferKeysForEncode!.has(g));
      if (preferred) chosen = preferred;
    }

    return `[${chosen[0]}]`;
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
 * Creates a complete Map<varId, varName> from VariableInstance rows visible on the given flow canvas.
 * Primary key is varId: every loaded variable participates exactly once (no name-only indirection).
 */
export function createVariableMappings(flowCanvasId?: string): Map<string, string> {
  const mappings = new Map<string, string>();

  try {
    const projectId: string | null = typeof localStorage !== 'undefined'
      ? localStorage.getItem('currentProjectId')
      : null;

    if (!projectId) return mappings;

    const fid = flowCanvasId ?? getActiveFlowCanvasId();
    const instances = variableCreationService.getVariablesForFlowScope(projectId, fid) ?? [];
    for (const v of instances) {
      const varId = typeof v.varId === 'string' ? v.varId.trim() : '';
      if (!varId) continue;
      const varName = typeof v.varName === 'string' ? v.varName.trim() : '';
      if (!varName) continue;
      mappings.set(varId, varName);
    }
  } catch (error) {
    console.warn('[ConditionCodeConverter] Could not load variable mappings', error);
  }

  return mappings;
}
