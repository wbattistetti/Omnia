// DialogueTaskService.ts
// Service per gestire i Task di dialogo (DDT tasks) con cache in memoria

import type { SemanticContract, EngineConfig, EngineEscalation } from '../types/semanticContract';

export interface DialogueTask {
  _id?: string;
  id?: string;
  name?: string;
  label: string;
  type?: string;
  icon?: string;
  subDataIds?: string[]; // ✅ Reference ai Task sottodati (nuova struttura)
  steps?: Record<string, any>; // ✅ Steps a root level: { "nodeId": { start: {...}, noMatch: {...} } }
  // ❌ DEPRECATED: steps - use steps instead
  steps?: any; // @deprecated Use steps instead
  dataContracts?: any[]; // Constraints
  constraints?: any[]; // Constraints (alias)
  examples?: any[];
  patterns?: {
    IT?: string[];
    EN?: string[];
    PT?: string[];
  };
  // ✅ NEW: Semantic contract and engine (persisted in template)
  semanticContract?: SemanticContract;  // Semantic contract (source of truth)
  engine?: EngineConfig;                // Extraction engine configuration (legacy: single engine)
  engineVersion?: number;               // Engine version for versioning
  engineEscalations?: EngineEscalation[]; // Engine escalation configurations (per-node)
  [key: string]: any;
}

export class DialogueTaskService {
  private static cache: DialogueTask[] = [];
  private static cacheLoaded = false;
  private static loadingPromise: Promise<DialogueTask[]> | null = null;
  // ✅ Traccia templates modificati in memoria (per salvarli quando si salva il progetto)
  private static modifiedTemplates = new Set<string>(); // Set di templateId modificati

  /**
   * Carica tutti i Task dal database Factory
   */
  static async loadTemplates(): Promise<DialogueTask[]> {
    if (this.cacheLoaded) {
      return this.cache;
    }

    // Se c'è già una richiesta in corso, aspetta quella
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this._loadTemplatesFromAPI();
    const result = await this.loadingPromise;
    this.loadingPromise = null;

    // ✅ NUOVO: Carica embedding in background dopo aver caricato i template
    this._loadEmbeddingsInBackground().catch(err => {
      console.warn('[DialogueTaskService] Failed to load embeddings:', err);
      // Non blocca - embedding può essere caricato dopo
    });

    return result;
  }

  /**
   * Carica embedding in background (non blocca il caricamento template)
   */
  private static async _loadEmbeddingsInBackground(): Promise<void> {
    try {
      const { EmbeddingService } = await import('./EmbeddingService');
      await EmbeddingService.loadEmbeddings('task');
    } catch (error) {
      console.error('[DialogueTaskService] Failed to load embeddings:', error);
      // Non blocca - embedding può essere caricato dopo
    }
  }

  /**
   * ✅ NEW: Force reload Factory templates from database (even if cache is loaded)
   * Used after saving new templates to Factory
   */
  static async reloadFactoryTemplates(): Promise<DialogueTask[]> {
    console.log('[DialogueTaskService] 🔄 Force reloading Factory templates');
    this.cacheLoaded = false; // Reset cache flag to force reload
    this.loadingPromise = null; // Clear any pending promise
    return this.loadTemplates();
  }

  private static async _loadTemplatesFromAPI(): Promise<DialogueTask[]> {
    try {
      const response = await fetch('/api/factory/dialogue-templates');

      if (!response.ok) {
        throw new Error(`Failed to load tasks: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.cache = Array.isArray(data) ? data : [];
      this.cacheLoaded = true;

      // ✅ Resetta lista templates modificati quando si ricarica la cache
      // (i templates ricaricati sono quelli dal database, quindi non sono più "modificati")
      this.modifiedTemplates.clear();
      console.log('[DialogueTaskService] 🧹 Cleared modified templates list after cache reload');

      return this.cache;
    } catch (error) {
      console.error('[DialogueTaskService] Errore nel caricamento dei task:', error);
      this.cache = [];
      return this.cache;
    }
  }

  /**
   * Ottiene tutti i Task dalla cache (sincrono, se già caricati)
   */
  static getAllTemplates(): DialogueTask[] {
    if (!this.cacheLoaded) {
      console.warn('[DialogueTaskService] Cache non ancora caricata, chiamare loadTemplates() prima');
      return [];
    }
    return this.cache;
  }

  /**
   * Verifica se la cache è caricata
   */
  static isCacheLoaded(): boolean {
    return this.cacheLoaded;
  }

  /**
   * Ottiene il numero di Task caricati
   */
  static getTemplateCount(): number {
    return this.cache.length;
  }

  /**
   * Ottiene un Task per ID (dalla cache)
   * Supporta ObjectId MongoDB (come stringa o oggetto) e confronto per _id, id, name, label
   * CASE-INSENSITIVE per name e label
   */
  static getTemplate(id: string): DialogueTask | null {
    if (!this.cacheLoaded) {
      console.warn('[DialogueTaskService] Cache non ancora caricata, chiamare loadTemplates() prima');
      return null;
    }

    // Normalizza l'ID cercato (potrebbe essere ObjectId come stringa)
    const normalizedId = String(id).trim();
    const normalizedIdLower = normalizedId.toLowerCase();

    // ✅ REMOVED: Log rumoroso di ricerca template - verrà ripristinato se necessario durante refactoring

    // Cerca nella cache
    const found = this.cache.find(t => {
      // ✅ Confronta _id (supporta ObjectId come oggetto o stringa)
      if (t._id) {
        // Se _id è un oggetto (MongoDB ObjectId), confronta con toString()
        const tIdStr = typeof t._id === 'object' && t._id.toString ? t._id.toString() : String(t._id);
        const tId = tIdStr.trim();
        if (tId === normalizedId) return true;
        // Se entrambi sono ObjectId-like (24 caratteri hex), confronta senza case
        if (tId.length === 24 && normalizedId.length === 24 && /^[0-9a-fA-F]{24}$/.test(tId) && /^[0-9a-fA-F]{24}$/.test(normalizedId)) {
          if (tId.toLowerCase() === normalizedIdLower) return true;
        }
      }
      // ✅ CRITICAL: Confronta t.id (primary field) - case-insensitive
      if (t.id) {
        const tIdStr = String(t.id).trim();
        if (tIdStr === normalizedId) return true; // Exact match first
        if (tIdStr.toLowerCase() === normalizedIdLower) return true; // Case-insensitive match
      }
      // ⚠️ NOTE: name e label sono usati solo come fallback, non dovrebbero essere usati per template lookup
      // Rimossi per evitare falsi positivi
      return false;
    });

    if (!found) {
      // Log dettagliato solo la prima volta per evitare spam
      if (!this._loggedMissingIds) {
        this._loggedMissingIds = new Set();
      }
      if (!this._loggedMissingIds.has(normalizedId)) {
        this._loggedMissingIds.add(normalizedId);
        const allTemplateIds = this.cache.map(t => ({
          id: t.id,
          _id: t._id ? (typeof t._id === 'object' ? t._id.toString() : String(t._id)) : null,
          label: t.label,
          name: t.name
        }));
        console.warn('[DialogueTaskService] ❌ Template non trovato per ID', {
          searchedId: normalizedId,
          searchedIdType: typeof id,
          cacheSize: this.cache.length,
          allTemplateIds,
          // ✅ DEBUG: Check for similar IDs (case-insensitive)
          similarIds: allTemplateIds.filter(t =>
            t.id && String(t.id).trim().toLowerCase() === normalizedIdLower
          )
        });
      }
    }
    // ✅ REMOVED: Log rumoroso quando template trovato - verrà ripristinato se necessario durante refactoring

    return found || null;
  }

  private static _loggedMissingIds?: Set<string>;

  /**
   * Marca un template come modificato (da chiamare quando si modifica dataContract in memoria)
   */
  static markTemplateAsModified(templateId: string): void {
    this.modifiedTemplates.add(templateId);
    // ✅ Log dettagliato per debugging
    const template = this.getTemplate(templateId);
    const templateInfo = template ? {
      has_id: !!template._id,
      _id: template._id ? (typeof template._id === 'object' ? template._id.toString() : String(template._id)) : null,
      hasId: !!template.id,
      id: template.id,
      label: template.label
    } : null;
    console.log('[DialogueTaskService] 📝 Template marked as modified', {
      templateId,
      totalModified: this.modifiedTemplates.size,
      templateInfo
    });
  }

  /**
   * Ottiene la lista di templateId modificati
   */
  static getModifiedTemplateIds(): string[] {
    return Array.from(this.modifiedTemplates);
  }

  /**
   * Rimuove un template dalla lista dei modificati (dopo il salvataggio)
   */
  static clearModifiedTemplate(templateId: string): void {
    this.modifiedTemplates.delete(templateId);
    console.log('[DialogueTaskService] ✅ Template cleared from modified list', {
      templateId,
      remainingModified: this.modifiedTemplates.size
    });
  }

  /**
   * Salva tutti i templates modificati nel database Factory
   */
  static async saveModifiedTemplates(): Promise<{ saved: number; failed: number }> {
    if (this.modifiedTemplates.size === 0) {
      console.log('[DialogueTaskService] ✅ No modified templates to save');
      return { saved: 0, failed: 0 };
    }

    console.log('[DialogueTaskService] 💾 Saving modified templates', {
      count: this.modifiedTemplates.size,
      templateIds: Array.from(this.modifiedTemplates)
    });

    const templateIds = Array.from(this.modifiedTemplates);
    const results = await Promise.allSettled(
      templateIds.map(async (templateId) => {
        const template = this.getTemplate(templateId);
        if (!template) {
          console.warn('[DialogueTaskService] ⚠️ Template not found for saving', { templateId });
          throw new Error(`Template not found: ${templateId}`);
        }

        try {
          // ✅ Prepara payload per salvataggio
          // ✅ IMPORTANTE: L'endpoint PUT cerca per _id MongoDB, non per id
          // Devo usare template._id se disponibile, altrimenti templateId potrebbe essere l'id
          const templateForSave = template as any;
          const mongoId = templateForSave._id
            ? (typeof templateForSave._id === 'object' ? templateForSave._id.toString() : String(templateForSave._id))
            : templateId;

          // ✅ Prepara payload (rimuovi _id dal payload ma usalo nell'URL)
          const { _id, ...templatePayload } = templateForSave;
          const payload = {
            ...templatePayload,
            updatedAt: new Date()
          };

          console.log('[DialogueTaskService] 💾 Saving template', {
            templateId,
            mongoId,
            has_id: !!templateForSave._id,
            _idType: typeof templateForSave._id,
            _idValue: templateForSave._id ? (typeof templateForSave._id === 'object' ? templateForSave._id.toString() : String(templateForSave._id)) : null,
            hasId: !!templateForSave.id,
            idValue: templateForSave.id
          });

          // ✅ Usa mongoId (template._id) se disponibile, altrimenti templateId
          // L'endpoint PUT cerca per _id MongoDB
          const response = await fetch(`/api/factory/tasks/${mongoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Failed to save template: ${response.status} ${errorText}`);
          }

          const saved = await response.json();
          console.log('[DialogueTaskService] ✅ Template saved', {
            templateId,
            hasDataContract: !!saved?.dataContract
          });
          this.clearModifiedTemplate(templateId);
          return { templateId, success: true };
        } catch (error: any) {
          console.error('[DialogueTaskService] ❌ Error saving template', {
            templateId,
            error: error.message || error
          });
          throw error;
        }
      })
    );

    const saved = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    if (failed > 0) {
      console.error('[DialogueTaskService] ❌ Some templates failed to save', {
        failed,
        total: templateIds.length,
        failedIds: results
          .map((r, idx) => r.status === 'rejected' ? templateIds[idx] : null)
          .filter(Boolean)
      });
    } else {
      console.log('[DialogueTaskService] ✅ All modified templates saved successfully', {
        saved,
        total: templateIds.length
      });
    }

    return { saved, failed };
  }

  /**
   * Mark a template as modified (for persistence tracking)
   */
  static markTemplateModified(templateId: string): void {
    this.modifiedTemplates.add(templateId);
  }

  /**
   * Resetta la lista dei templates modificati (utile per testing o reset)
   */
  static clearAllModifiedTemplates(): void {
    this.modifiedTemplates.clear();
    console.log('[DialogueTaskService] 🧹 All modified templates cleared');
  }

  /**
   * Aggiunge un template alla cache in memoria (senza salvare nel DB)
   * Utile per template generati dal Wizard che devono essere disponibili in memoria
   * ma non ancora salvati nel database
   */
  static addTemplate(template: DialogueTask): void {
    // ✅ Assicura che la cache sia marcata come caricata (prima di getTemplate)
    if (!this.cacheLoaded) {
      this.cacheLoaded = true;
    }

    // Verifica che non esista già
    const templateId = template.id || template._id || '';
    const templateIdStr = String(templateId).trim();

    console.log('[DialogueTaskService] 🔍 Adding template to cache', {
      templateId: templateIdStr,
      templateIdType: typeof templateId,
      templateIdLength: templateIdStr.length,
      templateHasId: !!template.id,
      templateHas_id: !!template._id,
      templateLabel: template.label,
      templateName: template.name,
      currentCacheSize: this.cache.length
    });

    const existing = this.cache.find(t => {
      const tId = t.id || t._id || '';
      const tIdStr = String(tId).trim();
      return tIdStr === templateIdStr ||
        (t.id && String(t.id).trim().toLowerCase() === templateIdStr.toLowerCase());
    });

    if (existing) {
      console.warn('[DialogueTaskService] ⚠️ Template già esistente, aggiornando', {
        templateId: templateIdStr,
        existingId: existing.id || existing._id,
        label: template.label,
        existingLabel: existing.label
      });
      // Aggiorna template esistente
      const index = this.cache.findIndex(t => {
        const tId = t.id || t._id || '';
        const tIdStr = String(tId).trim();
        return tIdStr === templateIdStr ||
          (t.id && String(t.id).trim().toLowerCase() === templateIdStr.toLowerCase());
      });
      if (index >= 0) {
        this.cache[index] = template;
        // ✅ REMOVED: Log rumoroso - verrà ripristinato se necessario durante refactoring
      }
    } else {
      // Aggiungi nuovo template
      this.cache.push(template);
      // ✅ REMOVED: Log rumoroso - verrà ripristinato se necessario durante refactoring
    }

    // ✅ NUOVO: Genera embedding in background (non blocca)
    this.generateEmbeddingForTemplate(template).catch(err => {
      console.warn('[DialogueTaskService] Failed to generate embedding:', err);
      // Non blocca il flusso - embedding può essere generato dopo
    });
  }

  /**
   * Genera embedding per un template e lo aggiunge alla cache in memoria
   * L'embedding viene salvato nel database SOLO quando l'utente clicca "Salva in libreria"
   */
  private static async generateEmbeddingForTemplate(template: DialogueTask): Promise<void> {
    const templateId = template.id || template._id;
    if (!templateId || !template.label) {
      return;
    }

    // Solo per task di tipo UtteranceInterpretation (type === 3)
    if (template.type !== 3) {
      return;
    }

    try {
      // 1. Calcola embedding
      const computeResponse = await fetch('/api/embeddings/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: template.label.trim() })
      });

      if (!computeResponse.ok) {
        throw new Error(`Failed to compute embedding: ${computeResponse.status}`);
      }

      const { embedding } = await computeResponse.json();

      // ✅ CRITICAL: Add embedding to EmbeddingService cache IMMEDIATELY (in memory only)
      // This ensures the template can be found by embedding matching before it's saved to database
      // The embedding will be saved to database ONLY when user clicks "Salva in libreria"
      try {
        const { EmbeddingService } = await import('./EmbeddingService');
        EmbeddingService.addEmbeddingToCache(templateId, template.label.trim(), embedding, 'task');
        console.log('[DialogueTaskService] ✅ Embedding added to EmbeddingService cache (in memory)', {
          templateId,
          label: template.label.substring(0, 50)
        });
      } catch (cacheError) {
        console.warn('[DialogueTaskService] ⚠️ Failed to add embedding to cache (non-blocking):', cacheError);
        // Non blocca - embedding sarà disponibile dopo il salvataggio in libreria
      }

      // ✅ REMOVED: Do NOT save embedding to database automatically
      // Embedding will be saved to database ONLY when user clicks "Salva in libreria"
      // The backend (/api/factory/dialogue-templates) will generate and save the embedding

      console.log('[DialogueTaskService] ✅ Embedding computed and cached (not saved to DB yet)', {
        templateId,
        label: template.label.substring(0, 50),
        note: 'Embedding will be saved to database when user clicks "Salva in libreria"'
      });
    } catch (error) {
      console.error('[DialogueTaskService] ❌ Failed to generate embedding:', error);
      // Non blocca - embedding può essere generato dopo
    }
  }
}

// Export per compatibilità
export default DialogueTaskService;

