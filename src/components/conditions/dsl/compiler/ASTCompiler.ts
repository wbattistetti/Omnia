// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { ASTNode } from '../parser/AST';
import { getBuiltinFunction } from './builtinFunctions';

/**
 * Variable mapping service interface.
 * Delegate variable name → GUID mapping to external service.
 */
export interface VariableMappingService {
  /**
   * Get GUID for a variable by its label.
   * Returns null if variable not found.
   */
  getVariableId(label: string, path?: string[]): Promise<string | null>;
}

/**
 * Compiler from AST to JavaScript.
 * Generates safe, deterministic JavaScript code.
 */
export class ASTCompiler {
  constructor(
    private variableMappingService: VariableMappingService
  ) {}

  /**
   * Compile AST to JavaScript function.
   */
  async compile(ast: ASTNode): Promise<string> {
    const jsCode = await this.compileNode(ast);
    return `function main(ctx) {
  try {
    return ${jsCode};
  } catch (e) {
    return false;
  }
}`;
  }

  /**
   * Compile a single AST node.
   */
  private async compileNode(node: ASTNode): Promise<string> {
    switch (node.type) {
      case 'or':
        return `(${await this.compileNode(node.left)} || ${await this.compileNode(node.right)})`;

      case 'and':
        return `(${await this.compileNode(node.left)} && ${await this.compileNode(node.right)})`;

      case 'not':
        return `!${await this.compileNode(node.operand)}`;

      case 'equals':
        return `${await this.compileNode(node.left)} === ${await this.compileNode(node.right)}`;

      case 'notEquals':
        return `${await this.compileNode(node.left)} !== ${await this.compileNode(node.right)}`;

      case 'greaterThan':
        return `${await this.compileNode(node.left)} > ${await this.compileNode(node.right)}`;

      case 'lessThan':
        return `${await this.compileNode(node.left)} < ${await this.compileNode(node.right)}`;

      case 'greaterThanOrEqual':
        return `${await this.compileNode(node.left)} >= ${await this.compileNode(node.right)}`;

      case 'lessThanOrEqual':
        return `${await this.compileNode(node.left)} <= ${await this.compileNode(node.right)}`;

      case 'function':
        return await this.compileFunction(node);

      case 'variable':
        return await this.compileVariable(node);

      case 'literal':
        return JSON.stringify(node.value);

      case 'parenthesized':
        return `(${await this.compileNode(node.expression)})`;
    }
  }

  /**
   * Compile function call.
   */
  private async compileFunction(node: { type: 'function'; name: string; args: ASTNode[] }): Promise<string> {
    const fnName = node.name.toUpperCase();
    const fnDef = getBuiltinFunction(fnName);

    if (!fnDef) {
      throw new Error(`Unknown function: ${fnName}`);
    }

    // Validate argument count
    if (node.args.length < fnDef.minArgs || node.args.length > fnDef.maxArgs) {
      throw new Error(
        `Function ${fnName} expects ${fnDef.minArgs}-${fnDef.maxArgs} arguments, got ${node.args.length}`
      );
    }

    const args = await Promise.all(node.args.map(a => this.compileNode(a)));

    switch (fnName) {
      // String functions
      case 'LCASE':
        return `(${args[0]} ?? "").toString().trim().toLowerCase()`;
      case 'UCASE':
        return `(${args[0]} ?? "").toString().trim().toUpperCase()`;
      case 'TRIM':
        return `(${args[0]} ?? "").toString().trim()`;
      case 'LEN':
        return `(${args[0]} ?? "").toString().length`;
      case 'LEFT':
        return `(${args[0]} ?? "").toString().substring(0, Math.max(0, Math.floor(${args[1]})))`;
      case 'RIGHT':
        return `(${args[0]} ?? "").toString().substring(Math.max(0, (${args[0]} ?? "").toString().length - Math.max(0, Math.floor(${args[1]}))))`;
      case 'MID':
        return `(${args[0]} ?? "").toString().substring(Math.max(0, Math.floor(${args[1]}) - 1), Math.max(0, Math.floor(${args[1]}) - 1) + Math.max(0, Math.floor(${args[2]})))`;
      case 'REPLACE':
        // Escape special regex characters in the find string
        // Use String.replace with a regex pattern to escape special characters
        return `(${args[0]} ?? "").toString().replace(new RegExp(String(${args[1]}).replace(/[.*+?^${'$'}{}()|[\\]\\\\]/g, '\\\\$&'), 'g'), String(${args[2]}))`;
      case 'CONTAINS':
        return `(${args[0]} ?? "").toString().includes(${args[1]}.toString())`;
      case 'STARTSWITH':
        return `(${args[0]} ?? "").toString().startsWith(${args[1]}.toString())`;
      case 'ENDSWITH':
        return `(${args[0]} ?? "").toString().endsWith(${args[1]}.toString())`;

      // Numeric functions
      case 'ABS':
        return `Math.abs(Number(${args[0]}) || 0)`;
      case 'ROUND':
        return `Math.round(Number(${args[0]}) || 0)`;
      case 'INT':
        return `Math.floor(Number(${args[0]}) || 0)`;

      // Type checking functions
      case 'ISEMPTY':
        return `(${args[0]} == null || ${args[0]} === "" || ${args[0]} === undefined)`;
      case 'ISNUMBER':
        return `typeof ${args[0]} === 'number' || !isNaN(Number(${args[0]}))`;
      case 'ISSTRING':
        return `typeof ${args[0]} === 'string'`;

      default:
        throw new Error(`Unimplemented function: ${fnName}`);
    }
  }

  /**
   * Compile variable reference.
   * Delegates to VariableMappingService for GUID resolution.
   */
  private async compileVariable(node: { type: 'variable'; name: string; path?: string[] }): Promise<string> {
    // Build full variable path
    const fullPath = node.path ? `${node.name}.${node.path.join('.')}` : node.name;

    // Get GUID from mapping service
    const variableId = await this.variableMappingService.getVariableId(node.name, node.path);

    if (!variableId) {
      // Variable not found - use path as fallback (will cause runtime error, but allows compilation)
      console.warn(`[ASTCompiler] Variable not found: ${fullPath}, using path as fallback`);
      return `ctx["${fullPath}"]`;
    }

    return `ctx["${variableId}"]`;
  }
}
