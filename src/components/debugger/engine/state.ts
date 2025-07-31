
/**
 * Checks if all required subfields for the expected type are present in variables.
 * For 'date', checks day, month, year.
 */
export function isDataSaturated(variables: Record<string, any>, expectedType: string): boolean {
  if (expectedType === 'date') {
    return Boolean(variables.day && variables.month && variables.year);
  }
  // Add more types as needed
  return !!variables.value;
}