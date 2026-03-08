// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Abstract Syntax Tree (AST) for DSL conditions.
 * All nodes are immutable and fully typed.
 */

export type ASTNode =
  | { type: 'or'; left: ASTNode; right: ASTNode }
  | { type: 'and'; left: ASTNode; right: ASTNode }
  | { type: 'not'; operand: ASTNode }
  | { type: 'equals'; left: ASTNode; right: ASTNode }
  | { type: 'notEquals'; left: ASTNode; right: ASTNode }
  | { type: 'greaterThan'; left: ASTNode; right: ASTNode }
  | { type: 'lessThan'; left: ASTNode; right: ASTNode }
  | { type: 'greaterThanOrEqual'; left: ASTNode; right: ASTNode }
  | { type: 'lessThanOrEqual'; left: ASTNode; right: ASTNode }
  | { type: 'function'; name: string; args: ASTNode[] }
  | { type: 'variable'; name: string; path?: string[] }
  | { type: 'literal'; value: string | number | boolean }
  | { type: 'parenthesized'; expression: ASTNode };

/**
 * Parse result with AST and errors.
 */
export interface ParseResult {
  ast: ASTNode | null;
  errors: ParseError[];
}

/**
 * Parse error with position information.
 */
export interface ParseError {
  message: string;
  position: {
    line: number; // 1-based
    column: number; // 1-based
  };
  severity: 'error' | 'warning';
  code?: string;
}

/**
 * Helper to create parse errors.
 */
export function createParseError(
  message: string,
  line: number,
  column: number,
  code?: string
): ParseError {
  return {
    message,
    position: { line, column },
    severity: 'error',
    code,
  };
}
