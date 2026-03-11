// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { ASTNode } from '../components/conditions/dsl/parser/AST';

/**
 * Converts UICode (with [label] placeholders) to ExecCode (with ctx["guid"])
 * Used when saving conditions to database
 */
export function convertUICodeToExecCode(
  uiCode: string,
  variableMappings: Map<string, string> // Map<guid, label>
): string {
  if (!uiCode || typeof uiCode !== 'string') {
    return uiCode;
  }

  // Replace [label] with ctx["guid"]
  return uiCode.replace(/\[\s*([A-Za-z0-9 _-]+)\s*\]/g, (match, label) => {
    // Find guid by label (reverse lookup)
    const guid = Array.from(variableMappings.entries()).find(
      ([g, l]) => l === label
    )?.[0];

    if (!guid) {
      console.warn(`[ConditionCodeConverter] Variable [${label}] not found in mappings`);
      return match; // Keep original if not found
    }

    return `ctx["${guid}"]`;
  });
}

/**
 * Converts ExecCode (with ctx["guid"]) to UICode (with [label] placeholders)
 * Used when loading conditions from database for display in editor
 */
export function convertExecCodeToUICode(
  execCode: string,
  variableMappings: Map<string, string> // Map<guid, label>
): string {
  if (!execCode || typeof execCode !== 'string') {
    return execCode;
  }

  // Replace ctx["guid"] with [label]
  return execCode.replace(/ctx\["([^"]+)"\]/g, (match, guid) => {
    const label = variableMappings.get(guid);

    if (!label) {
      console.warn(`[ConditionCodeConverter] GUID ${guid} not found in mappings`);
      return match; // Keep original if not found
    }

    return `[${label}]`;
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
 * Creates variable mappings from VariableCreationService.
 * Returns Map<varId, varName> for conversion.
 */
export function createVariableMappings(): Map<string, string> {
  const mappings = new Map<string, string>();

  try {
    const { variableCreationService } = require('../services/VariableCreationService');
    const projectId: string | null = typeof localStorage !== 'undefined'
      ? localStorage.getItem('currentProjectId')
      : null;

    if (!projectId) return mappings;

    const allVarNames: string[] = variableCreationService.getAllVarNames(projectId) ?? [];
    for (const varName of allVarNames) {
      const varId: string | null = variableCreationService.getVarIdByVarName(projectId, varName);
      if (varId) {
        mappings.set(varId, varName);
      }
    }
  } catch (error) {
    console.warn('[ConditionCodeConverter] Could not load variable mappings', error);
  }

  return mappings;
}
