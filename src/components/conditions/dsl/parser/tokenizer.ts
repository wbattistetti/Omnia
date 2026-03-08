// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Tokenizer for DSL input.
 * Converts input string into tokens with precise position information.
 */

export type TokenType =
  | 'VARIABLE' // [Name] or [Object.Field]
  | 'STRING' // "text"
  | 'NUMBER' // 123 or 123.45
  | 'BOOLEAN' // TRUE or FALSE
  | 'KEYWORD' // AND, OR, NOT
  | 'FUNCTION' // LCase, UCase, Trim, etc.
  | 'OPERATOR' // =, <>, >, <, >=, <=
  | 'LPAREN' // (
  | 'RPAREN' // )
  | 'LBRACKET' // [
  | 'RBRACKET' // ]
  | 'DOT' // .
  | 'COMMA' // ,
  | 'IDENTIFIER' // fallback for unrecognized identifiers
  | 'UNKNOWN' // invalid input
  | 'EOF'; // end of file

export interface Token {
  type: TokenType;
  value: string;
  position: {
    line: number; // 1-based
    column: number; // 1-based
  };
}

/**
 * Tokenizer for DSL.
 * Robust tokenization with precise error reporting.
 */
export class Tokenizer {
  private input: string;
  private current: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];

  constructor(input: string) {
    this.input = input;
  }

  /**
   * Tokenize the input string.
   */
  tokenize(): Token[] {
    this.tokens = [];
    this.current = 0;
    this.line = 1;
    this.column = 1;

    while (!this.isAtEnd()) {
      this.skipWhitespace();
      if (this.isAtEnd()) break;

      const token = this.scanToken();
      if (token) {
        this.tokens.push(token);
      }
    }

    // Add EOF token
    this.tokens.push({
      type: 'EOF',
      value: '',
      position: { line: this.line, column: this.column },
    });

    return this.tokens;
  }

  /**
   * Scan a single token.
   */
  private scanToken(): Token | null {
    const start = this.current;
    const startLine = this.line;
    const startColumn = this.column;
    const char = this.advance();

    // Single character tokens
    switch (char) {
      case '(':
        return this.createToken('LPAREN', '(', startLine, startColumn);
      case ')':
        return this.createToken('RPAREN', ')', startLine, startColumn);
      case '[':
        // Check if this is a variable: [Name] or [Object.Field]
        // Variables can contain spaces, so we need to scan until the closing bracket
        return this.variable();
      case ']':
        // This should only appear after a variable token, but handle it as bracket if needed
        return this.createToken('RBRACKET', ']', startLine, startColumn);
      case '.':
        return this.createToken('DOT', '.', startLine, startColumn);
      case ',':
        return this.createToken('COMMA', ',', startLine, startColumn);
      case '=':
        return this.createToken('OPERATOR', '=', startLine, startColumn);
      case '>':
        if (this.match('=')) {
          return this.createToken('OPERATOR', '>=', startLine, startColumn);
        }
        return this.createToken('OPERATOR', '>', startLine, startColumn);
      case '<':
        if (this.match('=')) {
          return this.createToken('OPERATOR', '<=', startLine, startColumn);
        }
        if (this.match('>')) {
          return this.createToken('OPERATOR', '<>', startLine, startColumn);
        }
        return this.createToken('OPERATOR', '<', startLine, startColumn);
      case '"':
        return this.string();
      default:
        if (this.isDigit(char)) {
          return this.number();
        }
        if (this.isAlpha(char)) {
          return this.identifier();
        }
        // Unknown character
        return this.createToken('UNKNOWN', char, startLine, startColumn);
    }
  }

  /**
   * Scan a string literal.
   */
  private string(): Token {
    const startLine = this.line;
    const startColumn = this.column - 1; // Include opening quote
    let value = '';

    while (this.peek() !== '"' && !this.isAtEnd()) {
      if (this.peek() === '\n') {
        this.line++;
        this.column = 1;
      }
      value += this.advance();
    }

    if (this.isAtEnd()) {
      // Unterminated string
      return this.createToken('UNKNOWN', `"${value}`, startLine, startColumn);
    }

    // Consume closing quote
    this.advance();
    return this.createToken('STRING', value, startLine, startColumn);
  }

  /**
   * Scan a number literal.
   */
  private number(): Token {
    const startLine = this.line;
    const startColumn = this.column - 1;
    let value = '';

    while (this.isDigit(this.peek())) {
      value += this.advance();
    }

    // Optional decimal part
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      value += this.advance(); // consume '.'
      while (this.isDigit(this.peek())) {
        value += this.advance();
      }
    }

    return this.createToken('NUMBER', value, startLine, startColumn);
  }

  /**
   * Scan a variable: [Name] or [Object.Field].
   * Variables can contain spaces and special characters.
   */
  private variable(): Token {
    const startLine = this.line;
    const startColumn = this.column - 1; // Include opening bracket
    let value = '';

    // Scan until closing bracket
    while (!this.isAtEnd() && this.peek() !== ']') {
      if (this.peek() === '\n') {
        // Newline inside variable - this is an error, but we'll continue scanning
        this.line++;
        this.column = 1;
        value += this.advance();
      } else {
        value += this.advance();
      }
    }

    if (this.isAtEnd()) {
      // Unterminated variable
      return this.createToken('UNKNOWN', `[${value}`, startLine, startColumn);
    }

    // Consume closing bracket
    this.advance();

    // Trim whitespace from variable name
    const trimmedValue = value.trim();

    return this.createToken('VARIABLE', trimmedValue, startLine, startColumn);
  }

  /**
   * Scan an identifier or keyword.
   */
  private identifier(): Token {
    const startLine = this.line;
    const startColumn = this.column - 1;
    let value = '';

    while (this.isAlphaNumeric(this.peek())) {
      value += this.advance();
    }

    // Check if it's a keyword
    const upperValue = value.toUpperCase();
    if (upperValue === 'AND' || upperValue === 'OR' || upperValue === 'NOT') {
      return this.createToken('KEYWORD', upperValue, startLine, startColumn);
    }

    // Check if it's a boolean
    if (upperValue === 'TRUE' || upperValue === 'FALSE') {
      return this.createToken('BOOLEAN', upperValue, startLine, startColumn);
    }

    // Check if it's a known function (case-insensitive)
    const knownFunctions = [
      'LCASE', 'UCASE', 'TRIM', 'LEN', 'LEFT', 'RIGHT', 'MID',
      'REPLACE', 'CONTAINS', 'STARTSWITH', 'ENDSWITH',
      'ABS', 'ROUND', 'INT',
      'ISEMPTY', 'ISNUMBER', 'ISSTRING'
    ];
    if (knownFunctions.includes(upperValue)) {
      return this.createToken('FUNCTION', upperValue, startLine, startColumn);
    }

    // Regular identifier
    return this.createToken('IDENTIFIER', value, startLine, startColumn);
  }

  /**
   * Skip whitespace and update position.
   */
  private skipWhitespace(): void {
    while (!this.isAtEnd()) {
      const char = this.peek();
      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance();
        this.column++;
      } else if (char === '\n') {
        this.advance();
        this.line++;
        this.column = 1;
      } else {
        break;
      }
    }
  }

  /**
   * Helper methods.
   */
  private isAtEnd(): boolean {
    return this.current >= this.input.length;
  }

  private advance(): string {
    if (this.isAtEnd()) return '';
    this.column++;
    return this.input[this.current++];
  }

  private peek(): string {
    if (this.isAtEnd()) return '';
    return this.input[this.current];
  }

  private peekNext(): string {
    if (this.current + 1 >= this.input.length) return '';
    return this.input[this.current + 1];
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.input[this.current] !== expected) return false;
    this.current++;
    this.column++;
    return true;
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_';
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }

  private createToken(type: TokenType, value: string, line: number, column: number): Token {
    return {
      type,
      value,
      position: { line, column },
    };
  }
}
