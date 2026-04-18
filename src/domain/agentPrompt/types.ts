/**
 * Internal representation (IR) for AI Agent prompts: structured sections plus backend
 * placeholder instances. This is the design-time source of truth; compiled platform
 * prompts are derived deterministically via `compileAgentPromptToPlatform`.
 */

/** One insertion of a backend placeholder token in section text (`{{omniabp:<id>}}`). */
export interface BackendPlaceholderInstance {
  /** Unique id for this insertion (matches token payload). */
  id: string;
  /** Key into {@link BACKEND_PLACEHOLDER_DEFINITIONS} / registry. */
  definitionId: string;
}

/** Registry entry: semantic name + I/O signature string for authoring. */
export interface BackendPlaceholderDefinition {
  id: string;
  label: string;
  description?: string;
  /** Human-readable data-exchange signature (inputs/outputs). */
  ioSignature: string;
}

/**
 * Rich prompt IR (platform-neutral). Not the final LLM prompt for a specific provider.
 */
export interface AgentStructuredSections {
  goal: string;
  operational_sequence: string;
  context: string;
  constraints: string;
  personality: string;
  tone: string;
  /** Optional few-shot or style examples (editor section). */
  examples?: string;
  /** Declared placeholder rows (tokens may appear in any section text). */
  backendPlaceholders: BackendPlaceholderInstance[];
}
