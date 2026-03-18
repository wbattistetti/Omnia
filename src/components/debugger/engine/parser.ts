import { ParseResult } from './types';
import { extractWithContractAsync } from '../../DialogueDataEngine/contracts/contractExtractor';
import { NLPContract } from '../../DialogueDataEngine/contracts/types';

/**
 * Parses user input using the NLP contract extraction system.
 * Supports GrammarFlow, regex, NER, LLM engines based on contract configuration.
 * ⚠️ NO HARDCODED FALLBACK: Uses only the contract extraction with escalation between enabled engines.
 * @param input User's raw input
 * @param expectedType The type of data expected (e.g., 'date', 'number')
 * @param contract NLP contract for extraction (required)
 */
export async function parseInput(
  input: string,
  expectedType: string,
  contract?: NLPContract
): Promise<ParseResult> {
  if (!input.trim()) {
    return {
      success: false,
      variables: {},
      error: 'No input provided',
    };
  }

  // ✅ Use contract-based extraction if available
  if (contract) {
    try {
      const extractionResult = await extractWithContractAsync(input, contract);

      if (extractionResult.hasMatch && extractionResult.values) {
        // Convert extraction values to variables format
        const variables: Record<string, any> = {};
        Object.entries(extractionResult.values).forEach(([key, value]) => {
          variables[key] = value;
        });

        return {
          success: true,
          variables,
          source: extractionResult.source,
        };
      } else {
        return {
          success: false,
          variables: {},
          error: 'No match found with any enabled extraction engine',
        };
      }
    } catch (error) {
      console.error('[Parser] Contract extraction failed:', error);
      return {
        success: false,
        variables: {},
        error: error instanceof Error ? error.message : 'Extraction failed',
      };
    }
  }

  // ⚠️ NO HARDCODED FALLBACK: Return error if no contract provided
  return {
    success: false,
    variables: {},
    error: 'No NLP contract provided for extraction',
  };
}