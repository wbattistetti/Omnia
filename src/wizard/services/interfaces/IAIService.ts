// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * AI Service Interface
 *
 * Defines the contract for AI-related services.
 * Provides semantic boundaries and type safety.
 */

export interface IAIService {
  /**
   * Generate structure data using AI.
   *
   * @param taskLabel - Task label
   * @param taskDescription - Optional task description
   * @param provider - AI provider (openai/groq)
   * @returns Promise with structure generation result
   *
   * @throws Error if generation fails
   */
  generateStructure(
    taskLabel: string,
    taskDescription?: string,
    provider?: 'openai' | 'groq'
  ): Promise<StructureGenerationResult>;

  /**
   * Regenerate structure based on feedback.
   *
   * @param taskLabel - Task label
   * @param feedback - User feedback
   * @param previousStructure - Previous structure
   * @param provider - AI provider (openai/groq)
   * @returns Promise with structure regeneration result
   *
   * @throws Error if regeneration fails
   */
  regenerateStructure(
    taskLabel: string,
    feedback: string,
    previousStructure: any[],
    provider?: 'openai' | 'groq'
  ): Promise<StructureGenerationResult>;

  /**
   * Generalize contextual messages.
   *
   * @param contextualMessages - Contextual messages
   * @param contract - Semantic contract
   * @param nodeLabel - Node label
   * @param provider - AI provider (openai/groq)
   * @returns Promise with generalized messages
   *
   * @throws Error if generalization fails
   */
  generalizeMessages(
    contextualMessages: Record<string, string[]>,
    contract: any,
    nodeLabel: string,
    provider?: 'openai' | 'groq'
  ): Promise<GeneralizedMessagesResult>;

  /**
   * Check if template is generalizable.
   *
   * @param contract - Semantic contract
   * @param nodeLabel - Node label
   * @param contextualMessages - Contextual messages
   * @param provider - AI provider (openai/groq)
   * @returns Promise with generalizability check result
   *
   * @throws Error if check fails
   */
  checkGeneralizability(
    contract: any,
    nodeLabel: string,
    contextualMessages: Record<string, string[]>,
    provider?: 'openai' | 'groq'
  ): Promise<GeneralizabilityResult>;

  /**
   * Check if template is equivalent to existing templates.
   *
   * @param currentTemplate - Current template
   * @param existingTemplates - Existing templates
   * @param provider - AI provider (openai/groq)
   * @returns Promise with equivalence check result
   *
   * @throws Error if check fails
   */
  checkTemplateEquivalence(
    currentTemplate: any,
    existingTemplates: any[],
    provider?: 'openai' | 'groq'
  ): Promise<EquivalenceResult>;
}

export interface StructureGenerationResult {
  success: boolean;
  structure?: any[];
  error?: string;
}

export interface GeneralizedMessagesResult {
  success: boolean;
  messages?: Record<string, string[]>;
  error?: string;
}

export interface GeneralizabilityResult {
  success: boolean;
  generalizable: boolean;
  confidence: number;
  reasons: string[];
  barriers: string[];
  suggestions: string[];
}

export interface EquivalenceResult {
  success: boolean;
  equivalent: boolean;
  matchingTemplateId?: string;
  confidence: number;
  matchReasons: string[];
  differences: string[];
}
