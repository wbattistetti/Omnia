/**
 * Conversational rules (error handling and related): design-time catalog separate from business use cases.
 * Task stores a full snapshot per rule; the shared library seeds new tasks.
 */

/** Stable id in {@link DEFAULT_CONVERSATIONAL_RULES_LIBRARY}. */
export type ConversationalRuleLibraryId = string;

export interface ConversationalRule {
  readonly id: string;
  /** When seeded from library; `null` for task-only custom rules. */
  readonly libraryRuleId: string | null;
  readonly label: string;
  /** Negotiation / trigger context (composer «Scenario»). */
  readonly scenario: string;
  /** Canonical assistant phrase example (composer «Messaggio agente»). */
  readonly exampleMessage: string;
  readonly sort_order: number;
  /** When false, excluded from runtime prompt projection. Default true. */
  readonly enabled?: boolean;
}

export interface ConversationalRuleLibraryEntry {
  readonly id: ConversationalRuleLibraryId;
  readonly label: string;
  readonly scenario: string;
  readonly exampleMessage: string;
  readonly sort_order: number;
}
