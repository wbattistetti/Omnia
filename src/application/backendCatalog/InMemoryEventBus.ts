import type { BackendCatalogDomainEvent } from './domainEvents';

/** Bus sincrono in-process (testabile). */
export class InMemoryEventBus {
  private handlers = new Set<(e: BackendCatalogDomainEvent) => void>();

  subscribe(handler: (e: BackendCatalogDomainEvent) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  publish(e: BackendCatalogDomainEvent): void {
    for (const h of this.handlers) {
      h(e);
    }
  }
}
