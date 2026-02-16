// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * TranslationType: Enum for different types of translations/metadata in the Translations collection
 *
 * Used to distinguish between:
 * - Label: UI labels (Sidebar, StepEditor, etc.)
 * - VariableReadableName: Variable names for Condition Editor and scripts (display)
 * - VariableDottedName: Hierarchical variable names (e.g., "Data di nascita del paziente.Giorno")
 * - Synonyms: NLP synonyms for pattern matching
 */
export enum TranslationType {
  /**
   * Default: UI label for displaying in Sidebar, StepEditor, etc.
   * This is the main label shown to users in the interface.
   */
  LABEL = 'Label',

  /**
   * Instance prompt text (for template prompts saved to Factory).
   * Used for prompt translations that will be cloned to instances.
   */
  INSTANCE = 'Instance',

  /**
   * Variable readable name for Condition Editor and scripts.
   * Example: "Data di nascita del paziente", "Giorno di nascita del paziente"
   * Used for display in script editor (converted to GUID at runtime).
   */
  VARIABLE_READABLE_NAME = 'VariableReadableName',

  /**
   * Variable dotted name (hierarchical format).
   * Example: "Data di nascita del paziente", "Data di nascita del paziente.Giorno"
   * Used for hierarchical variable references in scripts.
   */
  VARIABLE_DOTTED_NAME = 'VariableDottedName',

  /**
   * NLP synonyms for pattern matching.
   * Used by PatternMemoryService for semantic matching.
   */
  SYNONYMS = 'Synonyms',
}

export type TranslationTypeType = TranslationType | `${TranslationType}`;

/**
 * Helper: Get default translation type (Label)
 */
export function getDefaultTranslationType(): TranslationType {
  return TranslationType.LABEL;
}

/**
 * Helper: Check if a type is a valid TranslationType
 */
export function isValidTranslationType(type: string | undefined | null): type is TranslationType {
  if (!type) return false;
  return Object.values(TranslationType).includes(type as TranslationType);
}
