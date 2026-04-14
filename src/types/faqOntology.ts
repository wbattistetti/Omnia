/**
 * FAQ Answering ontology tree: hierarchical concepts with Grammar (intermediate) and Faqs (leaves).
 * Leaf = node with no children; type is derived, not stored.
 */

/** Drop zone relative to a node row (HTML5 / react-dnd hover bands). */
export enum OntologyDropPosition {
  Before = 'before',
  After = 'after',
  Inside = 'inside',
}

export interface OntologyNode {
  id: string;
  /** Display name; unique among siblings (case-insensitive), enforced in UI. */
  name: string;
  /** Keywords — only meaningful for non-leaf nodes. */
  grammar: string[];
  /** FAQ questions — only for leaf nodes. */
  faqs: string[];
  children: OntologyNode[];
  /** UI-only: branch expanded in the tree. */
  expanded?: boolean;
}

export interface OntologyDropTarget {
  nodeId: string;
  position: OntologyDropPosition;
}
