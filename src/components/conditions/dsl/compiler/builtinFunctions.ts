// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Built-in functions registry for DSL.
 */

export interface BuiltinFunction {
  name: string;
  minArgs: number;
  maxArgs: number;
  description: string;
  category: 'string' | 'numeric' | 'boolean' | 'type';
}

export const BUILTIN_FUNCTIONS: Record<string, BuiltinFunction> = {
  // String functions
  LCASE: { name: 'LCase', minArgs: 1, maxArgs: 1, description: 'Convert string to lowercase', category: 'string' },
  UCASE: { name: 'UCase', minArgs: 1, maxArgs: 1, description: 'Convert string to uppercase', category: 'string' },
  TRIM: { name: 'Trim', minArgs: 1, maxArgs: 1, description: 'Remove leading and trailing whitespace', category: 'string' },
  LEN: { name: 'Len', minArgs: 1, maxArgs: 1, description: 'Get string length', category: 'string' },
  LEFT: { name: 'Left', minArgs: 2, maxArgs: 2, description: 'Get leftmost N characters', category: 'string' },
  RIGHT: { name: 'Right', minArgs: 2, maxArgs: 2, description: 'Get rightmost N characters', category: 'string' },
  MID: { name: 'Mid', minArgs: 3, maxArgs: 3, description: 'Get substring from position with length', category: 'string' },
  REPLACE: { name: 'Replace', minArgs: 3, maxArgs: 3, description: 'Replace occurrences in string', category: 'string' },
  CONTAINS: { name: 'Contains', minArgs: 2, maxArgs: 2, description: 'Check if string contains substring', category: 'boolean' },
  STARTSWITH: { name: 'StartsWith', minArgs: 2, maxArgs: 2, description: 'Check if string starts with substring', category: 'boolean' },
  ENDSWITH: { name: 'EndsWith', minArgs: 2, maxArgs: 2, description: 'Check if string ends with substring', category: 'boolean' },

  // Numeric functions
  ABS: { name: 'Abs', minArgs: 1, maxArgs: 1, description: 'Get absolute value', category: 'numeric' },
  ROUND: { name: 'Round', minArgs: 1, maxArgs: 1, description: 'Round to nearest integer', category: 'numeric' },
  INT: { name: 'Int', minArgs: 1, maxArgs: 1, description: 'Get integer part', category: 'numeric' },

  // Type checking functions
  ISEMPTY: { name: 'IsEmpty', minArgs: 1, maxArgs: 1, description: 'Check if value is empty', category: 'type' },
  ISNUMBER: { name: 'IsNumber', minArgs: 1, maxArgs: 1, description: 'Check if value is a number', category: 'type' },
  ISSTRING: { name: 'IsString', minArgs: 1, maxArgs: 1, description: 'Check if value is a string', category: 'type' },
};

/**
 * Get function definition by name (case-insensitive).
 */
export function getBuiltinFunction(name: string): BuiltinFunction | undefined {
  return BUILTIN_FUNCTIONS[name.toUpperCase()];
}

/**
 * Get all function names.
 */
export function getAllFunctionNames(): string[] {
  return Object.values(BUILTIN_FUNCTIONS).map(f => f.name);
}
