/**
 * Serializable refinement operations (chronological) for design-time refine API.
 */

export type StructuredRefinementOp =
  | { type: 'delete'; start: number; end: number; text: string }
  | { type: 'insert'; position: number; text: string };
