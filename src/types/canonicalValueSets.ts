// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * CanonicalExample: A single canonical example with input and expected output
 * These examples define the expected behavior for ALL engines (engine-agnostic)
 */
export interface CanonicalExample {
  input: string;                    // Natural language input from user
  expected: Record<string, any> | null; // Expected canonical output (null if incomplete/ambiguous)
  description?: string;             // Brief explanation of the example
  confidence?: number;               // Expected confidence (0-1) for ambiguous examples
}

/**
 * CanonicalValueSets: Comprehensive value sets that define expected behavior
 * These are part of the Semantic Contract and are engine-agnostic
 * All engines must respect these canonical examples
 */
export interface CanonicalValueSets {
  /**
   * Complete examples: Full, valid inputs with all required fields
   * All engines should extract these successfully
   */
  complete: CanonicalExample[];

  /**
   * Partial examples: Inputs missing some optional fields
   * Engines should extract what's available, with missing fields as null/undefined
   */
  partial: CanonicalExample[];

  /**
   * Incomplete examples: Inputs missing required fields
   * Engines should NOT accept these as complete (should trigger re-ask)
   */
  incomplete: CanonicalExample[];

  /**
   * Ambiguous examples: Inputs that could be interpreted in multiple ways
   * Engines should handle with lower confidence or require disambiguation
   */
  ambiguous: CanonicalExample[];

  /**
   * Noisy examples: Inputs with extra words, filler, or irrelevant information
   * Engines should still extract correctly despite noise
   */
  noisy: CanonicalExample[];

  /**
   * Stress examples: Edge cases, boundary values, unusual formats
   * Engines should handle gracefully or return null if too extreme
   */
  stress: CanonicalExample[];
}

/**
 * Coverage statistics for canonical value sets
 */
export interface CanonicalValueSetsCoverage {
  complete: number;
  partial: number;
  incomplete: number;
  ambiguous: number;
  noisy: number;
  stress: number;
  total: number;
}
