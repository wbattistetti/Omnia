/**
 * Lightweight pub/sub so non-React code (e.g. applyFlowDocumentToStores) can signal that
 * flow slice `meta.translations` may have changed, without subscribing to every FlowWorkspaceSnapshot update.
 */

type Listener = () => void;
const listeners = new Set<Listener>();

/** Call after loading/applying a FlowDocument so hooks like useDDTTranslations can refresh merged keys. */
export function notifyFlowSliceTranslationsChanged(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* noop */
    }
  });
}

export function subscribeFlowSliceTranslationsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
