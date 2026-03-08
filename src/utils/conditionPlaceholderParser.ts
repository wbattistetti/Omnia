// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Parses condition with [Nome variabile] placeholders and replaces them with semantic values.
 * Used for evaluating conditions in readable format.
 *
 * @param condition - Condition string with [Nome variabile] placeholders
 * @param variableStore - Variable store with label -> semantic value mapping
 * @returns Condition string with placeholders replaced by values
 */
export function parseConditionWithPlaceholders(
  condition: string,
  variableStore: Record<string, any>
): string {
  if (!condition || typeof condition !== 'string') {
    return condition;
  }

  // Replace [Nome variabile] with semantic value
  return condition.replace(/\[\s*([A-Za-z0-9 _-]+)\s*\]/g, (match, label) => {
    const value = variableStore[label];

    if (value === undefined || value === null) {
      // Variable not found - throw error or return placeholder
      throw new Error(`Variable [${label}] not found in variableStore. Available variables: ${Object.keys(variableStore).join(', ')}`);
    }

    // Serialize value for insertion in condition
    if (typeof value === 'string') {
      return `"${value}"`;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    } else if (value === null) {
      return 'null';
    } else if (value === undefined) {
      return 'undefined';
    } else {
      // Complex object - serialize as JSON
      return JSON.stringify(value);
    }
  });
}

/**
 * Validates that all placeholders in condition correspond to existing variables.
 * @param condition - Condition string with [Nome variabile] placeholders
 * @param variableStore - Variable store with label -> semantic value mapping
 * @returns Array of missing variable labels
 */
export function validateConditionPlaceholders(
  condition: string,
  variableStore: Record<string, any>
): string[] {
  if (!condition || typeof condition !== 'string') {
    return [];
  }

  const missing: string[] = [];
  const placeholderRegex = /\[\s*([A-Za-z0-9 _-]+)\s*\]/g;
  let match;

  while ((match = placeholderRegex.exec(condition)) !== null) {
    const label = match[1];
    if (!(label in variableStore)) {
      missing.push(label);
    }
  }

  return missing;
}
