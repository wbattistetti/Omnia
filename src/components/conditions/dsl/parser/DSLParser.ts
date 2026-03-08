// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { Tokenizer, Token, TokenType } from './tokenizer';
import { ASTNode, ParseResult, ParseError, createParseError } from './AST';

/**
 * Parser for DSL → AST.
 * Implements recursive descent parsing with error recovery.
 */
export class DSLParser {
  private tokens: Token[] = [];
  private current: number = 0;
  private errors: ParseError[] = [];

  /**
   * Parse DSL input into AST.
   */
  parse(input: string): ParseResult {
    // Reset state
    this.current = 0;
    this.errors = [];

    // Tokenize
    const tokenizer = new Tokenizer(input);
    this.tokens = tokenizer.tokenize();

    // Debug: log tokens (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('[DSLParser] Tokens:', this.tokens.map(t => `${t.type}:${t.value}`).join(' '));
    }

    // Check for tokenization errors
    const tokenErrors = this.tokens.filter(t => t.type === 'UNKNOWN');
    if (tokenErrors.length > 0) {
      this.errors.push(...tokenErrors.map(t => createParseError(
        `Unexpected character: ${t.value}`,
        t.position.line,
        t.position.column
      )));
    }

    // Parse expression
    let ast: ASTNode | null = null;
    try {
      ast = this.parseExpression();

      // Check if we consumed all tokens
      // parseOr() should have consumed all OR/AND expressions via its while loops
      // If there are remaining tokens, they are unexpected
      if (!this.isAtEnd() && this.peek().type !== 'EOF') {
        const token = this.peek();
        // This should not happen if parseOr/parseAnd loops work correctly
        // But if it does, report the error
        this.errors.push(createParseError(
          `Unexpected token: ${token.value} (type: ${token.type})`,
          token.position.line,
          token.position.column
        ));
      }
    } catch (error: any) {
      // Parser error - already added to errors array
      if (this.errors.length === 0) {
        this.errors.push(createParseError(
          error.message || 'Parse error',
          1,
          1
        ));
      }
    }

    return {
      ast: this.errors.length === 0 ? ast : null,
      errors: this.errors,
    };
  }

  /**
   * Parse expression (entry point).
   */
  private parseExpression(): ASTNode {
    return this.parseOr();
  }

  /**
   * Parse OR expression (lowest precedence).
   */
  private parseOr(): ASTNode {
    let left = this.parseAnd();

    while (this.match('KEYWORD', 'OR')) {
      const right = this.parseAnd();
      left = { type: 'or', left, right };
    }

    return left;
  }

  /**
   * Parse AND expression.
   */
  private parseAnd(): ASTNode {
    let left = this.parseNot();

    while (this.match('KEYWORD', 'AND')) {
      const right = this.parseNot();
      left = { type: 'and', left, right };
    }

    return left;
  }

  /**
   * Parse NOT expression.
   */
  private parseNot(): ASTNode {
    if (this.match('KEYWORD', 'NOT')) {
      return { type: 'not', operand: this.parseComparison() };
    }
    return this.parseComparison();
  }

  /**
   * Parse comparison expression.
   */
  private parseComparison(): ASTNode {
    const left = this.parseValue();

    // Check for comparison operators
    if (this.match('OPERATOR', '=')) {
      return { type: 'equals', left, right: this.parseValue() };
    }
    if (this.match('OPERATOR', '<>')) {
      return { type: 'notEquals', left, right: this.parseValue() };
    }
    if (this.match('OPERATOR', '>=')) {
      return { type: 'greaterThanOrEqual', left, right: this.parseValue() };
    }
    if (this.match('OPERATOR', '<=')) {
      return { type: 'lessThanOrEqual', left, right: this.parseValue() };
    }
    if (this.match('OPERATOR', '>')) {
      return { type: 'greaterThan', left, right: this.parseValue() };
    }
    if (this.match('OPERATOR', '<')) {
      return { type: 'lessThan', left, right: this.parseValue() };
    }

    // No operator - return value as-is
    return left;
  }

  /**
   * Parse value (function, variable, literal, or parenthesized).
   */
  private parseValue(): ASTNode {
    // Parenthesized expression
    if (this.match('LPAREN', '(')) {
      const expr = this.parseExpression();
      this.consume('RPAREN', ')', 'Expected closing parenthesis');
      return { type: 'parenthesized', expression: expr };
    }

    // Variable: [Name] or [Object.Field]
    if (this.check('VARIABLE')) {
      return this.parseVariable();
    }

    // Function call
    if (this.check('FUNCTION')) {
      return this.parseFunction();
    }

    // Literal
    return this.parseLiteral();
  }

  /**
   * Parse variable: [Name] or [Object.Field].
   * The tokenizer already extracted the full variable name including dots.
   */
  private parseVariable(): ASTNode {
    // Use consume with 2 parameters (type and message)
    const token = this.consume('VARIABLE', 'Expected variable name');
    const fullName = token.value.trim();

    // Split by dot to get name and path
    const parts = fullName.split('.');
    const name = parts[0].trim();
    const path = parts.length > 1 ? parts.slice(1).map(p => p.trim()) : undefined;

    return {
      type: 'variable',
      name,
      path: path && path.length > 0 ? path : undefined,
    };
  }

  /**
   * Parse function call: FunctionName(arg1, arg2, ...).
   */
  private parseFunction(): ASTNode {
    const token = this.consume('FUNCTION', 'Expected function name');
    const name = token.value.toUpperCase();

    this.consume('LPAREN', '(', 'Expected opening parenthesis');

    const args: ASTNode[] = [];
    if (!this.check('RPAREN', ')')) {
      do {
        args.push(this.parseValue());
      } while (this.match('COMMA', ','));
    }

    this.consume('RPAREN', ')', 'Expected closing parenthesis');

    return {
      type: 'function',
      name,
      args,
    };
  }

  /**
   * Parse literal (string, number, or boolean).
   */
  private parseLiteral(): ASTNode {
    if (this.match('STRING')) {
      const token = this.previous();
      return { type: 'literal', value: token.value };
    }

    if (this.match('NUMBER')) {
      const token = this.previous();
      const numValue = token.value.includes('.')
        ? parseFloat(token.value)
        : parseInt(token.value, 10);
      return { type: 'literal', value: numValue };
    }

    if (this.match('BOOLEAN')) {
      const token = this.previous();
      const boolValue = token.value === 'TRUE';
      return { type: 'literal', value: boolValue };
    }

    // Error: expected literal
    const token = this.peek();
    throw new Error(`Expected literal, got ${token.type}: ${token.value}`);
  }

  /**
   * Helper methods.
   */
  private isAtEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private check(type: TokenType, value?: string): boolean {
    if (this.isAtEnd()) return false;
    const token = this.peek();
    if (token.type !== type) return false;
    if (value !== undefined && token.value !== value) return false;
    return true;
  }

  private match(type: TokenType, value?: string): boolean {
    if (this.check(type, value)) {
      this.advance();
      return true;
    }
    return false;
  }

  // Overload signatures
  private consume(type: TokenType, message: string): Token;
  private consume(type: TokenType, value: string, message: string): Token;
  private consume(type: TokenType, valueOrMessage: string, message?: string): Token {
    if (message === undefined) {
      // Two-parameter version: type and message only
      const msg = valueOrMessage;
      if (!this.check(type)) {
        const token = this.peek();
        const error = createParseError(
          `${msg}, got ${token.type}: ${token.value}`,
          token.position.line,
          token.position.column
        );
        this.errors.push(error);
        throw new Error(msg);
      }
      return this.advance();
    } else {
      // Three-parameter version: type, value, and message
      const value = valueOrMessage;
      if (!this.check(type, value)) {
        const token = this.peek();
        const error = createParseError(
          `${message}, got ${token.type}: ${token.value}`,
          token.position.line,
          token.position.column
        );
        this.errors.push(error);
        throw new Error(message);
      }
      return this.advance();
    }
  }
}
