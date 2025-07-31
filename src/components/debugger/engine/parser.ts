import { ParseResult } from './types';

/**
 * Parses user input using an LLM (mocked here, ready for OpenAI integration).
 * Extracts date subfields and detects missing subdata.
 * @param input User's raw input
 * @param expectedType The type of data expected (e.g., 'date', 'number')
 */
export async function parseInput(input: string, expectedType: string): Promise<ParseResult> {
  // --- MOCKED LOGIC ---
  // In real use, call OpenAI API here and parse the result.
  if (!input.trim()) {
    return {
      success: false,
      variables: {},
      error: 'No input provided',
    };
  }

  if (expectedType === 'date') {
    // Naive parsing for demo: dd/mm/yyyy or d-m-yyyy
    const dateMatch = input.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dateMatch) {
      const [_, day, month, year] = dateMatch;
      return {
        success: true,
        variables: {
          day: parseInt(day, 10),
          month: parseInt(month, 10),
          year: parseInt(year, 10),
          dateOfBirth: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
        },
      };
    } else {
      // Try to extract partials
      const yearMatch = input.match(/\b(\d{4})\b/);
      const monthMatch = input.match(/\b(0?[1-9]|1[0-2])\b/);
      const dayMatch = input.match(/\b(0?[1-9]|[12][0-9]|3[01])\b/);
      const missing: string[] = [];
      if (!dayMatch) missing.push('day');
      if (!monthMatch) missing.push('month');
      if (!yearMatch) missing.push('year');
      return {
        success: false,
        variables: {
          ...(dayMatch ? { day: parseInt(dayMatch[0], 10) } : {}),
          ...(monthMatch ? { month: parseInt(monthMatch[0], 10) } : {}),
          ...(yearMatch ? { year: parseInt(yearMatch[0], 10) } : {}),
        },
        missingSubdata: missing,
        error: 'Incomplete date',
      };
    }
  }

  // Fallback for other types
  return {
    success: true,
    variables: { value: input },
  };
}