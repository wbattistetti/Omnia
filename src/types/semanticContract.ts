// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * StructuredConstraint: Defines validation constraints for a field
 * These constraints come from the template and are used for validation and engine generation
 */
export interface StructuredConstraint {
  min?: number;                 // Minimum value (for numbers)
  max?: number;                 // Maximum value (for numbers)
  minLength?: number;           // Minimum length (for strings)
  maxLength?: number;           // Maximum length (for strings)
  format?: string[];            // Allowed formats (e.g., ["numeric", "textual", "date"])
  pattern?: string;             // Regex pattern (if applicable)
  required?: boolean;           // Whether field is required
  examples?: {
    valid?: string[];           // Valid example values
    invalid?: string[];         // Invalid example values
    edgeCases?: string[];      // Edge case examples
  };
  description?: string;         // Natural language description of the constraint
}

/**
 * SemanticSubgroup: Defines a single subgroup in the semantic contract
 * Represents a sub-field that must be extracted (e.g., day, month, year for a date)
 */
export interface SemanticSubgroup {
  subTaskKey: string;           // Technical key (e.g., "day", "month", "year")
  label: string;                // UI label (e.g., "Day", "Month", "Year")
  meaning: string;              // Semantic description (e.g., "numeric day of the month (1-31)")
  type?: string;                // Data type (number, string, date, etc.)
  optional?: boolean;           // Whether this field is optional at contract level
  formats?: string[];           // Allowed formats (e.g., ["numeric", "textual"])
  normalization?: string;       // Normalization rule (e.g., "year always 4 digits (61 -> 1961, 05 -> 2005)")
  constraints?: StructuredConstraint; // Structured constraints from template
}

/**
 * RedefinitionPolicy: Defines how to handle entity redefinition
 * This is a semantic property of the data, not of the extraction engine
 */
export type RedefinitionPolicy =
  | 'last_wins'              // Last occurrence wins (default)
  | 'first_wins'             // First occurrence wins
  | 'explicit_correction'    // Only apply if explicit correction detected ("no, scusa...")
  | 'accumulate';            // Keep all occurrences

/**
 * SemanticContract: The semantic contract that defines WHAT must be recognized
 * This is the source of truth for the entire task lifecycle:
 * - Used to generate AI prompts
 * - Used at runtime for validation, normalization, constraints
 * - Persisted in the task template
 *
 * Each node (root and children) has its own Semantic Contract.
 * Contracts are generated per-node and persisted separately.
 */
export interface SemanticContract {
  entity: {
    label: string;            // Entity label (e.g., "Date of Birth")
    type: string;             // Entity type (e.g., "date", "email", "phone")
    description: string;      // Entity description (e.g., "a date composed of day, month, year")
  };
  subentities?: SemanticSubgroup[]; // Sub-entities (only if node is composite)
  constraints?: StructuredConstraint; // Constraints for the main entity
  normalization?: string;     // Normalization rule for the main entity
  redefinitionPolicy?: RedefinitionPolicy; // How to handle redefinition (default: 'last_wins')
  outputCanonical: {
    format: 'object' | 'value'; // Output format: 'object' for composite, 'value' for simple
    keys?: string[];           // Canonical output keys (e.g., ["day", "month", "year"]) - only for 'object'
  };
  canonicalExamples?: import('./canonicalValueSets').CanonicalValueSets; // Canonical value sets (engine-agnostic examples)
  version?: number;           // Contract version for versioning
  createdAt?: Date;           // Creation date
  updatedAt?: Date;           // Last update date

  // Legacy fields for backward compatibility (will be removed)
  mainGroup?: {
    name: string;
    description: string;
    kind?: string;
  };
  subgroups?: SemanticSubgroup[]; // Legacy alias for subentities
}

/**
 * EngineConfig: Defines the extraction engine configuration
 * Persisted in the task template along with the semantic contract
 * Each node can have multiple engine configs (one per engine type)
 */
export type EngineType = 'regex' | 'llm' | 'rule_based' | 'ner' | 'embedding';

export interface EngineConfig {
  type: EngineType;
  config: {
    // Regex engine
    regex?: string;             // Regex pattern with named groups

    // LLM engine
    llmPrompt?: string;         // LLM extraction prompt template
    llmModel?: string;           // LLM model to use (optional)

    // Rule-based engine
    rules?: Rule[];              // Explicit if-then rules

    // NER engine
    nerEntityTypes?: Record<string, string>; // Mapping: subTaskKey -> entity type (e.g., "day" -> "DATE_COMPONENT")
    nerContextPatterns?: Record<string, string>; // Context patterns for disambiguation

    // Embedding engine
    embeddingExamples?: {
      positive?: string[];       // Positive examples for training
      negative?: string[];       // Negative examples for training
    };
    embeddingThreshold?: number; // Similarity threshold (0-1)
  };
  version: number;              // Engine version
  generatedAt: Date;            // Generation timestamp
  generatedBy?: 'ai' | 'manual'; // How it was generated
}

/**
 * EngineEscalation: Defines the escalation sequence of engines for a node
 * Engines are tried in order until one succeeds or all fail
 * Persisted in the task template
 */
export interface EngineEscalation {
  nodeId: string;               // Node ID this escalation applies to
  engines: Array<{
    type: EngineType;           // Engine type
    priority: number;            // Priority order (lower = tried first)
    enabled: boolean;            // Whether this engine is enabled
  }>;
  defaultEngine?: EngineType;   // Default engine to use if escalation fails
}

/**
 * Rule: For rule_based engine
 */
export interface Rule {
  condition: string;           // Condition description
  action: string;               // Action to take
  examples?: string[];          // Example inputs
}

/**
 * ExtractionResult: Canonical output format
 * Always produced by runtime, regardless of engine
 * All engines must produce this same format
 */
export interface ExtractionResult {
  values: Record<string, any>;  // Canonical values (e.g., { day: "12", month: "04", year: "2020" })
  hasMatch: boolean;             // Whether extraction was successful
  source: EngineType | null;   // Which engine was used
  errors?: string[];             // Validation errors if any
  confidence?: number;           // Confidence score (0-1)
}
