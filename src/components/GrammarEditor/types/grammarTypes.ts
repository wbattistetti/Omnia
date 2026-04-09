// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * NodeBinding: Heterogeneous binding for a grammar node
 * Supports: slot, semantic-set, semantic-value
 */
export type NodeBinding =
  | { type: 'slot'; slotId: string }
  | { type: 'semantic-set'; setId: string }
  | { type: 'semantic-value'; valueId: string };

/**
 * GrammarNode: Node in the grammar graph
 * The VB.NET runtime reads this format directly
 */
export interface GrammarNode {
  id: string;                       // UUID
  label: string;                     // Main word (e.g., "voglio")
  synonyms: string[];                // List of synonyms (e.g., ["vorrei", "desidero"])
  regex?: string;                    // Optional regex pattern (e.g., "[Vv]oglio")

  // Semantics: heterogeneous bindings list
  // Constraints (enforced by validateBindings):
  // - Maximum one slot
  // - Either one or more semantic sets OR one semantic value (not both)
  bindings: NodeBinding[];

  // Node properties
  optional: boolean;                 // Optional node
  repeatable: boolean;                // Repeatable node

  // Graphical position
  position: { x: number; y: number };

  // Metadata
  createdAt: number;
  updatedAt: number;
}

/**
 * GrammarEdge: Connection between nodes
 * The VB.NET runtime traverses these edges
 */
export interface GrammarEdge {
  id: string;                       // UUID
  source: string;                    // Source node ID
  target: string;                    // Target node ID
  type: 'sequential' | 'alternative' | 'optional';
  label?: string;                    // Optional edge label
}

/**
 * Grammar: Complete grammar structure
 * This is the format that the VB.NET runtime reads directly
 */
export interface Grammar {
  id: string;
  name: string;
  nodes: GrammarNode[];
  edges: GrammarEdge[];
  slots: SemanticSlot[];             // Available semantic slots
  semanticSets: SemanticSet[];        // Available semantic sets
  /**
   * G2: mandatory mapping grammarSlot.id → flow variable id (never implicit TaskTreeNode identity).
   */
  slotBindings?: Array<{ grammarSlotId: string; flowVariableId: string }>;
  metadata: {
    createdAt: number;
    updatedAt: number;
    version: string;
  };
}

/**
 * SemanticSlot: Semantic output slot
 * Example: from_city, to_city, intent, date
 */
export interface SemanticSlot {
  id: string;                       // UUID
  name: string;                     // Slot name (e.g., "from_city")
  type: 'string' | 'number' | 'date' | 'boolean' | 'object';
}

/**
 * SemanticValue: Single semantic value
 * Example: MILANO with synonyms ["Milano", "città del Duomo", ...]
 */
export interface SemanticValue {
  id: string;                       // UUID
  value: string;                     // Semantic value (e.g., "MILANO")
  synonyms: string[];                // Linguistic synonyms
  regex?: string;                    // Optional regex pattern
}

/**
 * SemanticSet: Set of semantic values
 * Example: CITY with values [MILANO, ROMA, TORINO, ...]
 */
export interface SemanticSet {
  id: string;                       // UUID
  name: string;                     // Set name (e.g., "CITY")
  values: SemanticValue[];          // Values in the set
}
