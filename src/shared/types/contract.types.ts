// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Shared Contract Types
 *
 * Types shared between wizard and response-editor modules.
 * Re-exports from existing types if available.
 */

// Re-export from existing semantic contract types
export type {
  SemanticContract,
  EngineConfig,
  EngineEscalation,
  EngineType
} from '../../types/semanticContract';

export interface AIMessages {
  start: string[];
  noInput: string[];
  noMatch: string[];
  confirmation: string[];
  success: string[];
}
