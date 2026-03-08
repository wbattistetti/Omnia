// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Grammar definition for DSL (EBNF-like).
 *
 * Expression = OrExpression
 * OrExpression = AndExpression (OR AndExpression)*
 * AndExpression = NotExpression (AND NotExpression)*
 * NotExpression = NOT? ComparisonExpression
 * ComparisonExpression = Value (Operator Value)?
 * Value = FunctionCall | Variable | Literal | ParenthesizedExpression
 * FunctionCall = Identifier "(" Arguments ")"
 * Arguments = (Value ("," Value)*)?
 * Variable = "[" Identifier ("." Identifier)* "]"
 * Literal = StringLiteral | NumberLiteral | BooleanLiteral
 * StringLiteral = "\"" [^"]* "\""
 * NumberLiteral = [0-9]+ ("." [0-9]+)?
 * BooleanLiteral = TRUE | FALSE
 * Operator = "=" | "<>" | ">" | "<" | ">=" | "<="
 * Identifier = [A-Za-z_][A-Za-z0-9_]*
 */

export const DSL_GRAMMAR = {
  // Precedence (lowest to highest)
  precedence: {
    OR: 1,
    AND: 2,
    NOT: 3,
    COMPARISON: 4,
  },

  // Operators
  operators: {
    equals: '=',
    notEquals: '<>',
    greaterThan: '>',
    lessThan: '<',
    greaterThanOrEqual: '>=',
    lessThanOrEqual: '<=',
  },

  // Keywords
  keywords: ['AND', 'OR', 'NOT'],

  // Boolean literals
  booleans: ['TRUE', 'FALSE'],

  // Built-in functions
  functions: [
    // String functions
    'LCase', 'UCase', 'Trim', 'Len', 'Left', 'Right', 'Mid',
    'Replace', 'Contains', 'StartsWith', 'EndsWith',
    // Numeric functions
    'Abs', 'Round', 'Int',
    // Type checking functions
    'IsEmpty', 'IsNumber', 'IsString',
  ],
} as const;
