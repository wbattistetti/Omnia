/**
 * Core types for UTF-16 operational-transform style text documents (single-user, local op log).
 */

import type { InsertOp } from './effectiveFromRevisionMask';

/** One edit step: indices are UTF-16 code unit offsets in the string at the time of application. */
export type OtOp =
  | { type: 'delete'; start: number; end: number }
  | { type: 'insert'; position: number; text: string };

/**
 * Snapshot of one structured section: immutable IA base, user op log, and materialized current text.
 */
export interface OtTextDocument {
  readonly revisionBase: string;
  readonly opLog: readonly OtOp[];
  readonly currentText: string;
}

/**
 * Minimal v1 persisted shape for migration to OT (matches PersistedSectionSnapshot fields).
 */
export interface V1SectionSnapshotLike {
  readonly base: string;
  readonly deletedMask: readonly boolean[];
  readonly inserts: readonly InsertOp[];
}
