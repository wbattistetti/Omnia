/**
 * Debounce eventi {@link FlowBackendCallsChanged} → un solo rebuild summary (riduce rumore audit).
 */

import type { BackendCatalogDomainEvent } from './domainEvents';

export type DebouncedFlowPayload = {
  projectId: string;
  taskIds: Set<string>;
  reason: 'create' | 'update' | 'delete';
};

export class DebouncedFlowBackendCallsBuffer {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly windowMs: number,
    private readonly flush: (merged: DebouncedFlowPayload) => void
  ) {}

  push(projectId: string, taskIds: readonly string[], reason: DebouncedFlowPayload['reason']): void {
    if (!this.pending) {
      this.pending = { projectId, taskIds: new Set(taskIds), reason };
    } else {
      for (const id of taskIds) this.pending.taskIds.add(id);
      this.pending.reason = reason;
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flushNow(), this.windowMs);
  }

  private pending: DebouncedFlowPayload | null = null;

  private flushNow(): void {
    this.timer = null;
    if (!this.pending) return;
    const p = this.pending;
    this.pending = null;
    this.flush(p);
  }

  /** Test / shutdown */
  destroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }
}

/** Filtra eventi per audit whitelist (no payload enormi). */
export function toAuditRecord(e: BackendCatalogDomainEvent): Record<string, unknown> | null {
  switch (e.type) {
    case 'ManualCatalogEntryChanged':
      return { kind: 'manual_catalog_crud', entryId: e.entryId, op: e.op };
    case 'SpecImportResult':
      return {
        kind: 'spec_import_result',
        bindingId: e.bindingId,
        ok: e.ok,
        sourceUrl: e.sourceUrl,
        contentHash: e.contentHash,
        errorCode: e.errorCode,
      };
    case 'CatalogRebuildSummary':
      return {
        kind: 'catalog_rebuilt_summary',
        trigger: e.trigger,
        entryCount: e.entryCount,
        durationMs: e.durationMs,
      };
    default:
      return null;
  }
}
