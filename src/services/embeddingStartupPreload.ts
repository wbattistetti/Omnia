/**
 * Precarica embedding e servizio compute all'avvio Omnia / apertura progetto.
 * Evita GET Mongo al primo Invio su una riga flowchart.
 */

/** Carica vettori factory (task + taskType) e scalda il modello Python (best-effort). */
export async function preloadFactoryEmbeddings(): Promise<void> {
  const { EmbeddingService } = await import('./EmbeddingService');
  await Promise.all([
    EmbeddingService.loadEmbeddings('taskType'),
    EmbeddingService.loadEmbeddings('task'),
    warmEmbeddingComputeService(),
  ]);
}

/** Merge embedding specifici del progetto (factory già in cache da avvio). */
export async function preloadProjectEmbeddings(projectId: string): Promise<void> {
  const id = String(projectId ?? '').trim();
  if (!id) return;
  const { EmbeddingService } = await import('./EmbeddingService');
  await EmbeddingService.loadEmbeddings('task', false, id);
}

/** Prima encode dopo avvio: carica MiniLM in memoria nel processo Python. */
async function warmEmbeddingComputeService(): Promise<void> {
  try {
    const res = await fetch('/api/embeddings/compute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'warmup' }),
    });
    if (!res.ok) return;
  } catch {
    // Python non avviato o Express down — non blocca l'app
  }
}
