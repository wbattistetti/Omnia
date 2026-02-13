// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Embedding Service
 * Generic service for handling semantic similarity search using embeddings
 *
 * Responsibilities:
 * - Load embeddings from backend into memory cache (filtered by type)
 * - Find best matching entity for a given label using cosine similarity
 * - Fallback: If embedding matching fails, returns null
 */

type EmbeddingEntry = {
  id: string;           // GUID dell'entità
  text: string;         // Label dell'entità
  embedding: Float32Array;  // Vettore embedding (384 dimensioni per MiniLM-L12-v2)
};

export class EmbeddingService {
  private static cache: Map<string, EmbeddingEntry[]> = new Map(); // Cache per type
  private static cacheLoaded: Set<string> = new Set(); // Traccia quali type sono caricati
  private static loadingPromises: Map<string, Promise<void>> = new Map(); // Promise per type

  /**
   * Carica embedding per un tipo specifico dal backend
   * @param type - Tipo di embedding da caricare (es. 'task', 'condition', ecc.)
   */
  static async loadEmbeddings(type: string = 'task'): Promise<void> {
    if (this.cacheLoaded.has(type)) return;

    const existingPromise = this.loadingPromises.get(type);
    if (existingPromise) return existingPromise;

    const promise = this._loadFromAPI(type);
    this.loadingPromises.set(type, promise);
    await promise;
    this.loadingPromises.delete(type);
  }

  private static async _loadFromAPI(type: string): Promise<void> {
    try {
      const response = await fetch(`/api/embeddings?type=${encodeURIComponent(type)}`);
      if (!response.ok) {
        throw new Error(`Failed to load embeddings: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      const entries = data.map((item: any) => ({
        id: item.id,
        text: item.text,
        embedding: new Float32Array(item.embedding)
      }));

      this.cache.set(type, entries);
      this.cacheLoaded.add(type);
      console.log(`[EmbeddingService] ✅ Loaded ${entries.length} embeddings (type: ${type})`);
    } catch (error) {
      console.error(`[EmbeddingService] ❌ Failed to load embeddings (type: ${type}):`, error);
      this.cache.set(type, []);
      // Non blocca - se cache vuota, findBestMatch ritorna null
    }
  }

  /**
   * Trova l'entità più simile usando cosine similarity
   *
   * @param inputText - Label da cercare (es. "chiedi la data di nascita del titolare")
   * @param type - Tipo di embedding da cercare (default: 'task')
   * @param threshold - Soglia di similarità (default: 0.70)
   * @returns ID dell'entità matchata o null se nessun match sopra la soglia
   */
  static async findBestMatch(
    inputText: string,
    type: string = 'task',
    threshold: number = 0.70
  ): Promise<string | null> {
    // 1. Assicura che la cache sia caricata per questo type
    await this.loadEmbeddings(type);

    const entries = this.cache.get(type) || [];
    if (entries.length === 0) {
      console.log(`[EmbeddingService] ⚠️ No embeddings available (type: ${type}), returning null`);
      return null; // Nessun embedding disponibile → fallback
    }

    if (!inputText || inputText.trim().length === 0) {
      return null;
    }

    // 2. Normalizza il testo prima di calcolare embedding (rimuove duplicazioni, normalizza spazi)
    const normalizedText = this.normalizeText(inputText);

    // 3. Calcola embedding dell'input
    let inputEmbedding: Float32Array;
    try {
      const response = await fetch('/api/embeddings/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: normalizedText })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[EmbeddingService] ❌ Failed to compute embedding: ${response.status} ${response.statusText}`, {
          errorText,
          type,
          inputText: inputText.substring(0, 50)
        });
        throw new Error(`Failed to compute embedding: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('Invalid embedding response format');
      }
      inputEmbedding = new Float32Array(data.embedding);
    } catch (error) {
      console.error(`[EmbeddingService] ❌ Failed to compute input embedding (type: ${type}):`, {
        error: error instanceof Error ? error.message : String(error),
        inputText: inputText.substring(0, 50),
        hint: 'Make sure Python FastAPI service is running on port 8000 and sentence-transformers is installed'
      });
      return null; // Fallback a wizard full
    }

    // 4. Calcola cosine similarity con tutte le entità di questo type
    let bestMatch: { id: string; similarity: number; text: string } | null = null;
    let topSimilarity = 0;
    let topMatchText = '';
    let topMatchId = '';

    // ✅ NUOVO: Array per tracciare tutti i punteggi (per debugging dettagliato)
    const allScores: Array<{ id: string; text: string; similarity: number }> = [];

    for (const entry of entries) {
      const similarity = this.cosineSimilarity(inputEmbedding, entry.embedding);

      // Salva tutti i punteggi per debugging
      allScores.push({
        id: entry.id,
        text: entry.text,
        similarity: similarity
      });

      // Traccia sempre il miglior match per debugging
      if (similarity > topSimilarity) {
        topSimilarity = similarity;
        topMatchText = entry.text;
        topMatchId = entry.id;
      }

      if (similarity >= threshold && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { id: entry.id, similarity, text: entry.text };
      }
    }

    // Ordina per similarità (decrescente) per mostrare i migliori match
    allScores.sort((a, b) => b.similarity - a.similarity);

    // 5. Log ESSENZIALE: mostra sempre il risultato (match o no match) + tutti i punteggi
    if (bestMatch) {
      // ✅ Match trovato (sopra soglia)
      console.log(
        `%c🧠 "${inputText}" → "${bestMatch.text}" (${bestMatch.similarity.toFixed(3)})`,
        'color: #4ade80; font-weight: bold; font-size: 14px;'
      );
    } else if (entries.length > 0 && topSimilarity > 0) {
      // ✅ No match (sotto soglia) - mostra sempre il miglior candidato
      console.log(
        `%c🧠 "${inputText}" → "${topMatchText}" (${topSimilarity.toFixed(3)}, soglia: ${threshold.toFixed(2)})`,
        'color: #fbbf24; font-weight: bold; font-size: 14px;'
      );
    } else if (entries.length === 0) {
      // ✅ Nessun embedding disponibile
      console.log(
        `%c🧠 "${inputText}" → Nessun embedding disponibile`,
        'color: #ef4444; font-weight: bold; font-size: 14px;'
      );
    }

    // ✅ Mostra sempre tutti i punteggi (anche se non passano la soglia)
    if (allScores.length > 0) {
      const scoresText = allScores.map(s => `${s.text} (${s.similarity.toFixed(3)})`).join(', ');
      console.log(`%c   Punteggi: ${scoresText}`, 'color: #94a3b8; font-size: 12px;');
    }

    return bestMatch?.id || null;
  }

  /**
   * Normalizza il testo rimuovendo duplicazioni e normalizzando spazi
   */
  private static normalizeText(text: string): string {
    let normalized = text.trim();

    // Rimuovi duplicazioni di parole comuni all'inizio
    // Es: "chiedi Chiedi la data" → "chiedi la data"
    normalized = normalized.replace(/^(chiedi|chiedere|richiedi|richiedere)\s+(chiedi|chiedere|richiedi|richiedere)\s+/i, '$1 ');

    // Normalizza spazi multipli
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Calcola cosine similarity tra due vettori
   */
  private static cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      console.warn('[EmbeddingService] Embedding dimension mismatch', {
        aLength: a.length,
        bLength: b.length
      });
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Helper per ottenere la similarità massima (per logging)
   */
  private static _getTopSimilarity(inputEmbedding: Float32Array, entries: EmbeddingEntry[]): number {
    let maxSimilarity = 0;
    for (const entry of entries) {
      const similarity = this.cosineSimilarity(inputEmbedding, entry.embedding);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
      }
    }
    return maxSimilarity;
  }

  /**
   * Verifica se la cache è caricata per un tipo specifico
   */
  static isLoaded(type: string = 'task'): boolean {
    return this.cacheLoaded.has(type);
  }

  /**
   * Ottiene il numero di embedding in cache per un tipo specifico
   */
  static getCacheSize(type: string = 'task'): number {
    return this.cache.get(type)?.length || 0;
  }
}
