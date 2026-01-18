// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Template Embedding Service
 * Handles semantic similarity search using embeddings
 *
 * Responsibilities:
 * - Pre-compute embeddings for all templates
 * - Calculate query embeddings
 * - Find top-K similar templates via cosine similarity
 *
 * Integration: Uses existing Python embedding service (intent_embeddings.py)
 * or can be extended to use Node.js embedding library
 */
class TemplateEmbeddingService {
  constructor() {
    this.templateEmbeddings = new Map(); // templateId -> { embedding, metadata }
    this.isInitialized = false;
    // FastAPI service URL (Python embedding service)
    this.embeddingServiceUrl = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8000';
    this.serviceAvailable = null; // Cache service availability check
  }

  /**
   * Initialize embeddings service
   * Checks if Python embedding service is available
   */
  async initialize() {
    if (this.isInitialized) return;

    console.log('[TemplateEmbeddingService] Initializing embeddings service...');
    console.log(`[TemplateEmbeddingService] Service URL: ${this.embeddingServiceUrl}`);

    // Check if Python embedding service is available
    try {
      const response = await fetch(`${this.embeddingServiceUrl}/api/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout for health check
      });

      if (response.ok) {
        this.serviceAvailable = true;
        console.log('[TemplateEmbeddingService] Python embedding service is available');
      } else {
        this.serviceAvailable = false;
        console.warn('[TemplateEmbeddingService] Python embedding service returned error');
      }
    } catch (error) {
      this.serviceAvailable = false;
      console.warn(
        `[TemplateEmbeddingService] Python embedding service not available: ${error.message}. ` +
        `Make sure FastAPI service is running on port 8000.`
      );
    }

    this.isInitialized = true;
  }

  /**
   * Build descriptive text for a template (used for embedding)
   * Combines: label, description, field labels, examples
   * @param {Object} template - Template object
   * @returns {string} Descriptive text
   */
  buildTemplateText(template) {
    const parts = [];

    // Main label
    if (template.label) {
      parts.push(template.label);
    }

    // Description if available
    if (template.description) {
      parts.push(template.description);
    }

    // Field labels from mainData
    if (template.mainData && Array.isArray(template.mainData)) {
      template.mainData.forEach(main => {
        if (main.label) {
          parts.push(main.label);
        }

        // SubData labels
        if (main.subData && Array.isArray(main.subData)) {
          main.subData.forEach(sub => {
            if (sub.label) {
              parts.push(sub.label);
            }
          });
        }
      });
    }

    // Examples if available (limit to first 3)
    if (template.examples && Array.isArray(template.examples)) {
      template.examples.slice(0, 3).forEach(ex => {
        if (typeof ex === 'string') {
          parts.push(ex);
        }
      });
    }

    return parts.join(' ').trim();
  }

  /**
   * Compute embedding for a text
   * Integrated with Python embedding service (intent_embeddings.py)
   * @param {string} text - Text to embed
   * @returns {Promise<Array>} Embedding vector
   */
  async computeEmbedding(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Text is required and must be a non-empty string');
    }

    try {
      const response = await fetch(`${this.embeddingServiceUrl}/api/embeddings/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Embedding service returned ${response.status}: ${errorText}`
        );
      }

      const data = await response.json();

      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('Invalid embedding response format');
      }

      console.log(
        `[TemplateEmbeddingService] Computed embedding: ` +
        `length=${data.embedding.length}, model=${data.model || 'unknown'}`
      );

      return data.embedding;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Embedding computation timeout (30s). Service may be unavailable.');
      }

      if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        throw new Error(
          `Embedding service unavailable at ${this.embeddingServiceUrl}. ` +
          `Make sure the Python FastAPI service is running on port 8000.`
        );
      }

      throw new Error(`Failed to compute embedding: ${error.message}`);
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   * @param {Array<number>} embedding1 - First embedding vector
   * @param {Array<number>} embedding2 - Second embedding vector
   * @returns {number} Cosine similarity (0-1)
   */
  cosineSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2) {
      return 0;
    }

    if (embedding1.length !== embedding2.length) {
      console.warn('[TemplateEmbeddingService] Embedding dimension mismatch');
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Pre-compute embeddings for all templates (called once at startup)
   * @param {Object} templates - All available templates
   */
  async precomputeEmbeddings(templates) {
    await this.initialize();

    // Check if service is available
    if (this.serviceAvailable === false) {
      throw new Error(
        'Embedding service is not available. ' +
        'Make sure the Python FastAPI service is running on port 8000.'
      );
    }

    const templateCount = Object.keys(templates).length;
    console.log(`[TemplateEmbeddingService] Pre-computing embeddings for ${templateCount} templates...`);

    // Clear existing embeddings
    this.templateEmbeddings.clear();

    let computed = 0;
    let failed = 0;
    let skipped = 0;

    for (const [templateId, template] of Object.entries(templates)) {
      try {
        const templateText = this.buildTemplateText(template);

        if (!templateText || templateText.trim().length === 0) {
          console.warn(`[TemplateEmbeddingService] Skipping template ${templateId} (empty text)`);
          skipped++;
          continue;
        }

        const embedding = await this.computeEmbedding(templateText);

        this.templateEmbeddings.set(templateId, {
          embedding,
          templateText,
          template
        });

        computed++;

        // Log progress every 10 templates
        if (computed % 10 === 0) {
          console.log(
            `[TemplateEmbeddingService] Progress: ${computed}/${templateCount} computed ` +
            `(${failed} failed, ${skipped} skipped)`
          );
        }
      } catch (error) {
        console.warn(
          `[TemplateEmbeddingService] Failed to compute embedding for ${templateId}:`,
          error.message
        );
        failed++;
      }
    }

    console.log(
      `[TemplateEmbeddingService] Pre-computed ${computed} embeddings ` +
      `(${failed} failed, ${skipped} skipped, ${templateCount} total)`
    );

    if (computed === 0) {
      throw new Error(
        'Failed to pre-compute any embeddings. ' +
        'Check embedding service availability and logs.'
      );
    }
  }

  /**
   * Find top-K most similar templates to user request
   * @param {string} userDesc - User description
   * @param {Object} templates - All available templates
   * @param {number} topK - Number of candidates to return (default: 5)
   * @param {number} minSimilarity - Minimum similarity threshold (default: 0.3)
   * @param {number} qualityThreshold - Quality threshold: if top candidate < this, return empty (default: 0.4)
   * @returns {Promise<Array>} Array of candidate templates
   */
  async findSimilarTemplates(userDesc, templates, topK = 5, minSimilarity = 0.3, qualityThreshold = 0.4) {
    await this.initialize();

    if (!userDesc || userDesc.trim().length === 0) {
      console.warn('[TemplateEmbeddingService] Empty user description');
      return [];
    }

    // If no pre-computed embeddings, compute on-the-fly
    if (this.templateEmbeddings.size === 0) {
      console.warn('[TemplateEmbeddingService] No pre-computed embeddings, computing on-the-fly...');
      await this.precomputeEmbeddings(templates);
    }

    if (this.templateEmbeddings.size === 0) {
      console.warn('[TemplateEmbeddingService] No embeddings available, returning empty candidates');
      return [];
    }

    try {
      // Compute embedding for user request
      const queryEmbedding = await this.computeEmbedding(userDesc);

      // Calculate similarities
      const similarities = [];

      for (const [templateId, data] of this.templateEmbeddings.entries()) {
        const similarity = this.cosineSimilarity(queryEmbedding, data.embedding);

        if (similarity >= minSimilarity) {
          similarities.push({
            templateId,
            template: data.template,
            similarity,
            templateText: data.templateText
          });
        }
      }

      // Sort by similarity (descending) and return top-K
      const topCandidates = similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

      const topSimilarity = topCandidates[0]?.similarity || 0;

      // Quality filter: if top candidate similarity is below quality threshold,
      // return empty array to avoid confusing the AI with irrelevant candidates
      if (topCandidates.length > 0 && topSimilarity < qualityThreshold) {
        console.log(
          `[TemplateEmbeddingService] Top candidate similarity (${topSimilarity.toFixed(3)}) ` +
          `below quality threshold (${qualityThreshold}). ` +
          `Returning no candidates to avoid confusion.`
        );
        return []; // Better to create new template than pass irrelevant candidate
      }

      console.log(
        `[TemplateEmbeddingService] Found ${topCandidates.length} candidate templates ` +
        `(top similarity: ${topSimilarity.toFixed(3)}, quality threshold: ${qualityThreshold})`
      );

      return topCandidates.map(item => item.template);

    } catch (error) {
      console.error('[TemplateEmbeddingService] Error finding similar templates:', error);
      // Fallback: return empty array (will trigger create_new)
      return [];
    }
  }

  /**
   * Clear all cached embeddings (useful for testing or reload)
   */
  clearCache() {
    this.templateEmbeddings.clear();
    this.isInitialized = false;
    console.log('[TemplateEmbeddingService] Cache cleared');
  }
}

module.exports = TemplateEmbeddingService;
