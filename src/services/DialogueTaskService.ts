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
  constraints?: any[]; // Constraints for data validation (required, min, max, pattern, etc.)
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
      // ✅ Tag every Factory template with source:'Factory' so saveModifiedTemplates
      // routes them back to the Factory DB instead of the project DB.
      const raw = Array.isArray(data) ? data : [];
      this.cache = raw.map((t: any) => {
        const template = t.source ? t : { ...t, source: 'Factory' };

        // ✅ CRITICAL: Normalize engine.enabled - ensure all engines have enabled property (default: true)
        if (template.dataContract?.engines && Array.isArray(template.dataContract.engines)) {
          template.dataContract.engines = template.dataContract.engines.map((engine: any) => {
            if (engine.enabled === undefined || engine.enabled === null) {
              return { ...engine, enabled: true };
            }
            return engine;
          });
        }

        // ✅ DEEP LOG: Check grammarFlow in loaded templates
        const grammarFlowEngine = template.dataContract?.engines?.find((e: any) => e.type === 'grammarflow');
        const hasGrammarFlow = !!grammarFlowEngine?.grammarFlow;
        if (hasGrammarFlow) {
          console.log('[DialogueTaskService] 📥 Factory template with grammarFlow loaded', {
            templateId: template.id,
            grammarFlowNodesCount: grammarFlowEngine.grammarFlow?.nodes?.length || 0,
            grammarFlowEdgesCount: grammarFlowEngine.grammarFlow?.edges?.length || 0,
          });
        }
        return template;
      });
      this.cacheLoaded = true;

      // ✅ DEEP LOG: Summary of loaded templates
      const templatesWithGrammarFlow = this.cache.filter((t: any) => {
        const grammarFlowEngine = t.dataContract?.engines?.find((e: any) => e.type === 'grammarflow');
        return !!grammarFlowEngine?.grammarFlow;
      });
      console.log('[DialogueTaskService] 📥 Factory templates loaded', {
        totalCount: this.cache.length,
        templatesWithGrammarFlowCount: templatesWithGrammarFlow.length,
        templatesWithGrammarFlowIds: templatesWithGrammarFlow.map((t: any) => t.id),
      });

      // ✅ Resetta lista templates modificati quando si ricarica la cache
      // (i templates ricaricati sono quelli dal database, quindi non sono più "modificati")
      this.modifiedTemplates.clear();
      console.log('[DialogueTaskService] 🧹 Cleared modified templates list after cache reload', {
        count: this.cache.length,
        source: 'Factory',
      });

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
    console.log('[DialogueTaskService] 📝 markTemplateAsModified CALLED', {
      templateId,
      templateIdType: typeof templateId,
      templateIdLength: templateId?.length,
      cacheLoaded: this.cacheLoaded,
      cacheSize: this.cache.length,
      wasAlreadyModified: this.modifiedTemplates.has(templateId),
    });

    // ✅ DEEP LOG: Check if template exists before marking as modified
    const template = this.getTemplate(templateId);
    if (!template) {
      console.error('[DialogueTaskService] ❌ CANNOT MARK AS MODIFIED: Template not found!', {
        templateId,
        cacheSize: this.cache.length,
        cacheTemplateIds: this.cache.map(t => t.id || t._id).slice(0, 20),
        allTemplateIds: this.cache.map(t => ({
          id: t.id,
          _id: t._id ? (typeof t._id === 'object' ? t._id.toString() : String(t._id)) : null,
        })).slice(0, 20),
      });
      // Still add to modified list in case template is loaded later
    } else {
      // ✅ DEEP LOG: Check grammarFlow in template before marking as modified
      const grammarFlowEngine = template.dataContract?.engines?.find((e: any) => e.type === 'grammarflow');
      console.log('[DialogueTaskService] 📝 Template found, checking grammarFlow', {
        templateId,
        hasDataContract: !!template.dataContract,
        enginesCount: template.dataContract?.engines?.length || 0,
        hasGrammarFlowEngine: !!grammarFlowEngine,
        hasGrammarFlow: !!grammarFlowEngine?.grammarFlow,
        grammarFlowNodesCount: grammarFlowEngine?.grammarFlow?.nodes?.length || 0,
        templateSource: (template as any).source,
      });
    }

    this.modifiedTemplates.add(templateId);

    // ✅ Log dettagliato per debugging
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
      templateInfo,
      modifiedTemplateIds: Array.from(this.modifiedTemplates),
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
  static async saveModifiedTemplates(projectId?: string): Promise<{ saved: number; failed: number }> {
    if (this.modifiedTemplates.size === 0) {
      console.log('[DialogueTaskService] ✅ No modified templates to save');
      return { saved: 0, failed: 0 };
    }

    console.log('[DialogueTaskService] 💾 Saving modified templates', {
      count: this.modifiedTemplates.size,
      templateIds: Array.from(this.modifiedTemplates),
      projectId
    });

    const templateIds = Array.from(this.modifiedTemplates);
    const results = await Promise.allSettled(
      templateIds.map(async (templateId) => {
        const template = this.getTemplate(templateId);
        if (!template) {
          console.warn('[DialogueTaskService] ⚠️ Template not found for saving', { templateId });
          throw new Error(`Template not found: ${templateId}`);
        }

        // ✅ DEEP LOG: Check template state BEFORE preparing payload
        const grammarFlowEngineBefore = template.dataContract?.engines?.find((e: any) => e.type === 'grammarflow');
        console.log('[DialogueTaskService] 🔍 Template state BEFORE payload preparation', {
          templateId,
          hasDataContract: !!template.dataContract,
          enginesCount: template.dataContract?.engines?.length || 0,
          grammarFlowEngineFound: !!grammarFlowEngineBefore,
          grammarFlowEngineKeys: grammarFlowEngineBefore ? Object.keys(grammarFlowEngineBefore) : [],
          hasGrammarFlow: !!grammarFlowEngineBefore?.grammarFlow,
          grammarFlowNodesCount: grammarFlowEngineBefore?.grammarFlow?.nodes?.length || 0,
          grammarFlowType: typeof grammarFlowEngineBefore?.grammarFlow,
          grammarFlowIsArray: Array.isArray(grammarFlowEngineBefore?.grammarFlow),
          grammarFlowIsObject: grammarFlowEngineBefore?.grammarFlow && typeof grammarFlowEngineBefore?.grammarFlow === 'object',
          grammarFlowIsNull: grammarFlowEngineBefore?.grammarFlow === null,
          grammarFlowIsUndefined: grammarFlowEngineBefore?.grammarFlow === undefined,
          fullGrammarFlowEngine: grammarFlowEngineBefore ? JSON.stringify(grammarFlowEngineBefore, null, 2).substring(0, 2000) : 'null',
        });

        try {
          const templateForSave = template as any;
          const mongoId = templateForSave._id
            ? (typeof templateForSave._id === 'object' ? templateForSave._id.toString() : String(templateForSave._id))
            : templateId;

          // Remove _id from payload (used in URL, not in body)
          const { _id, ...templatePayload } = templateForSave;
          const payload = {
            ...templatePayload,
            updatedAt: new Date()
          };

          // ✅ DEEP LOG: Check payload state AFTER preparation
          const payloadGrammarFlowEngine = payload.dataContract?.engines?.find((e: any) => e.type === 'grammarflow');
          console.log('[DialogueTaskService] 🔍 Payload state AFTER preparation', {
            templateId,
            hasDataContract: !!payload.dataContract,
            enginesCount: payload.dataContract?.engines?.length || 0,
            grammarFlowEngineFound: !!payloadGrammarFlowEngine,
            grammarFlowEngineKeys: payloadGrammarFlowEngine ? Object.keys(payloadGrammarFlowEngine) : [],
            hasGrammarFlow: !!payloadGrammarFlowEngine?.grammarFlow,
            grammarFlowNodesCount: payloadGrammarFlowEngine?.grammarFlow?.nodes?.length || 0,
            grammarFlowType: typeof payloadGrammarFlowEngine?.grammarFlow,
            grammarFlowIsNull: payloadGrammarFlowEngine?.grammarFlow === null,
            grammarFlowIsUndefined: payloadGrammarFlowEngine?.grammarFlow === undefined,
            payloadKeys: Object.keys(payload).slice(0, 20),
            fullPayloadGrammarFlowEngine: payloadGrammarFlowEngine ? JSON.stringify(payloadGrammarFlowEngine, null, 2).substring(0, 2000) : 'null',
          });

          // ✅ VERIFY: Check if grammarFlow was lost during payload preparation
          if (grammarFlowEngineBefore?.grammarFlow && !payloadGrammarFlowEngine?.grammarFlow) {
            console.error('[DialogueTaskService] ❌ GRAMMARFLOW LOST DURING PAYLOAD PREPARATION!', {
              templateId,
              hadGrammarFlowBefore: !!grammarFlowEngineBefore?.grammarFlow,
              hasGrammarFlowAfter: !!payloadGrammarFlowEngine?.grammarFlow,
              grammarFlowNodesCountBefore: grammarFlowEngineBefore?.grammarFlow?.nodes?.length || 0,
              grammarFlowNodesCountAfter: payloadGrammarFlowEngine?.grammarFlow?.nodes?.length || 0,
              templatePayloadKeys: Object.keys(templatePayload).slice(0, 20),
              templatePayloadDataContractKeys: templatePayload.dataContract ? Object.keys(templatePayload.dataContract) : [],
            });
          }

          // Route to correct DB based on template.source:
          // - source === 'Factory' → PUT /api/factory/tasks/:id
          // - otherwise (source === 'Project' or undefined) → POST /api/projects/:pid/templates
          const isFactory = templateForSave.source === 'Factory';

          // ✅ DEEP LOG: Check grammarFlow specifically (for existing log)
          const grammarFlowEngine = payloadGrammarFlowEngine || templateForSave.dataContract?.engines?.find((e: any) => e.type === 'grammarflow');
          const hasGrammarFlow = !!grammarFlowEngine?.grammarFlow;
          const grammarFlowNodesCount = grammarFlowEngine?.grammarFlow?.nodes?.length || 0;

          console.log('[DialogueTaskService] 💾 Saving template', {
            templateId,
            mongoId,
            source: templateForSave.source,
            isFactory,
            hasDataContract: !!payload.dataContract,
            hasConstraints: !!payload.constraints,
            hasSteps: !!payload.steps,
            enginesCount: payload.dataContract?.engines?.length || 0,
            hasGrammarFlowEngine: !!grammarFlowEngine,
            hasGrammarFlow: hasGrammarFlow,
            grammarFlowNodesCount: grammarFlowNodesCount,
            dataContractKeys: payload.dataContract ? Object.keys(payload.dataContract) : [],
          });

          // ✅ DEEP LOG: Full payload preview (first 2000 chars)
          const payloadPreview = JSON.stringify(payload, null, 2).substring(0, 2000);
          console.log('[DialogueTaskService] 📦 Payload preview (first 2000 chars)', {
            templateId,
            payloadPreview,
          });

          let response: Response;

          if (isFactory) {
            // Factory template → PUT /api/factory/tasks/:id
            response = await fetch(`/api/factory/tasks/${mongoId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          } else {
            // Project template (source: 'Project' or undefined) → POST /api/projects/:pid/templates
            // This endpoint saves the template as-is without any field stripping.
            if (!projectId) {
              throw new Error(
                `Cannot save Project template "${templateId}" without projectId. ` +
                `Pass projectId to saveModifiedTemplates().`
              );
            }
            response = await fetch(`/api/projects/${projectId}/templates`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          }

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Failed to save template: ${response.status} ${errorText}`);
          }

          const saved = await response.json();

          // ✅ DEEP LOG: Check saved response for grammarFlow
          const savedGrammarFlowEngine = saved?.dataContract?.engines?.find((e: any) => e.type === 'grammarflow');
          const savedHasGrammarFlow = !!savedGrammarFlowEngine?.grammarFlow;
          const savedGrammarFlowNodesCount = savedGrammarFlowEngine?.grammarFlow?.nodes?.length || 0;

          console.log('[DialogueTaskService] ✅ Template saved', {
            templateId,
            source: templateForSave.source,
            isFactory,
            hasDataContract: !!saved?.dataContract,
            savedEnginesCount: saved?.dataContract?.engines?.length || 0,
            savedHasGrammarFlowEngine: !!savedGrammarFlowEngine,
            savedHasGrammarFlow: savedHasGrammarFlow,
            savedGrammarFlowNodesCount: savedGrammarFlowNodesCount,
            savedDataContractKeys: saved?.dataContract ? Object.keys(saved.dataContract) : [],
          });

          // ✅ VERIFY: Check if grammarFlow was actually saved
          if (hasGrammarFlow && !savedHasGrammarFlow) {
            console.error('[DialogueTaskService] ❌ GRAMMARFLOW LOST DURING SAVE!', {
              templateId,
              hadGrammarFlowBefore: hasGrammarFlow,
              hasGrammarFlowAfter: savedHasGrammarFlow,
              grammarFlowNodesCountBefore: grammarFlowNodesCount,
              grammarFlowNodesCountAfter: savedGrammarFlowNodesCount,
            });
          }
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
   * ✅ SAVE GRAMMARFLOW FROM STORE: Save all grammarFlow from GrammarEditor store to templates
   * This ensures grammarFlow is saved even if the editor is still open when saving the project
   */
  static async saveAllGrammarFlowFromStore(): Promise<{ saved: number; failed: number }> {
    try {
      // Import useGrammarStore dynamically to avoid circular dependencies
      const { useGrammarStore } = await import('../components/GrammarEditor/core/state/grammarStore');
      const currentGrammar = useGrammarStore.getState().grammar;

      if (!currentGrammar) {
        console.log('[DialogueTaskService] ✅ No grammar in store to save');
        return { saved: 0, failed: 0 };
      }

      console.log('[DialogueTaskService] 🔄 Saving grammarFlow from store', {
        grammarId: currentGrammar.id,
        nodesCount: currentGrammar.nodes?.length || 0,
        edgesCount: currentGrammar.edges?.length || 0,
      });

      // ✅ Get templates that have grammarFlow editor open (registered in window.__grammarFlowEditors)
      const grammarFlowEditors = (globalThis as any).__grammarFlowEditors as Map<string, boolean> | undefined;
      const openTemplateIds = grammarFlowEditors ? Array.from(grammarFlowEditors.keys()) : [];

      console.log('[DialogueTaskService] 📊 Templates with open grammarFlow editor', {
        count: openTemplateIds.length,
        templateIds: openTemplateIds,
      });

      if (openTemplateIds.length === 0) {
        console.log('[DialogueTaskService] ✅ No templates with open grammarFlow editor found');
        return { saved: 0, failed: 0 };
      }

      // Update each template with the current grammar from store
      let saved = 0;
      let failed = 0;

      for (const templateId of openTemplateIds) {
        try {
          const template = this.getTemplate(templateId);
          if (!template) {
            console.warn('[DialogueTaskService] ⚠️ Template not found for grammarFlow save', {
              templateId,
            });
            failed++;
            continue;
          }

          if (!template.dataContract) {
            template.dataContract = {
              templateId,
              templateName: template.label || templateId,
              subDataMapping: {},
              engines: [],
              outputCanonical: { format: 'value' }
            };
          }

          const engines = template.dataContract.engines || [];
          let grammarFlowEngine = engines.find((e: any) => e.type === 'grammarflow');

          if (grammarFlowEngine) {
            // Update existing GrammarFlow engine
            grammarFlowEngine.grammarFlow = currentGrammar;
          } else {
            // Create new GrammarFlow engine
            engines.push({
              type: 'grammarflow',
              enabled: true,
              grammarFlow: currentGrammar
            });
            template.dataContract.engines = engines;
          }

          this.markTemplateAsModified(templateId);
          saved++;
          console.log('[DialogueTaskService] ✅ Updated grammarFlow in template', {
            templateId,
            nodesCount: currentGrammar.nodes?.length || 0,
          });
        } catch (error) {
          console.error('[DialogueTaskService] ❌ Error updating grammarFlow in template', {
            templateId,
            error,
          });
          failed++;
        }
      }

      return { saved, failed };
    } catch (error) {
      console.error('[DialogueTaskService] ❌ Error saving grammarFlow from store', error);
      return { saved: 0, failed: 1 };
    }
  }

  /**
   * Resetta la lista dei templates modificati (utile per testing o reset)
   */
  static clearAllModifiedTemplates(): void {
    this.modifiedTemplates.clear();
    console.log('[DialogueTaskService] 🧹 All modified templates cleared');
  }

  /**
   * Registers externally loaded templates (e.g. from project DB) into the in-memory cache.
   * Unlike addTemplate, this does NOT generate embeddings and does NOT mark templates as modified.
   * Use this when loading a project to make project templates resolvable via getTemplate().
   */
  static registerExternalTemplates(templates: DialogueTask[]): void {
    console.log('[DialogueTaskService] 📥 registerExternalTemplates START', {
      templatesCount: templates.length,
      cacheSizeBefore: this.cache.length,
    });

    let added = 0;
    let updated = 0;

    templates.forEach(rawTemplate => {
      const templateId = String(rawTemplate.id || rawTemplate._id || '').trim();
      if (!templateId) return;

      // ✅ DEEP LOG: Check grammarFlow in incoming template
      const incomingGrammarFlowEngine = rawTemplate.dataContract?.engines?.find((e: any) => e.type === 'grammarflow');
      const incomingHasGrammarFlow = !!incomingGrammarFlowEngine?.grammarFlow;

      // ✅ Tag every project template with source:'Project' so saveModifiedTemplates
      // routes them back to the project DB instead of the Factory DB.
      const template: DialogueTask = (rawTemplate as any).source
        ? rawTemplate
        : { ...rawTemplate, source: 'Project' };

      // ✅ CRITICAL: Normalize engine.enabled - ensure all engines have enabled property (default: true)
      if (template.dataContract?.engines && Array.isArray(template.dataContract.engines)) {
        template.dataContract.engines = template.dataContract.engines.map((engine: any) => {
          if (engine.enabled === undefined || engine.enabled === null) {
            return { ...engine, enabled: true };
          }
          return engine;
        });
      }

      const existingIdx = this.cache.findIndex(t =>
        String(t.id || t._id || '').trim() === templateId
      );

      if (existingIdx >= 0) {
        const existing = this.cache[existingIdx] as any;
        const existingGrammarFlowEngine = existing.dataContract?.engines?.find((e: any) => e.type === 'grammarflow');
        const existingHasGrammarFlow = !!existingGrammarFlowEngine?.grammarFlow;

        console.log('[DialogueTaskService] 🔄 Template duplicate found during registration', {
          templateId,
          existingSource: existing.source,
          incomingSource: (template as any).source,
          existingHasDataContract: !!existing.dataContract,
          incomingHasDataContract: !!template.dataContract,
          existingHasGrammarFlow: existingHasGrammarFlow,
          incomingHasGrammarFlow: incomingHasGrammarFlow,
          existingGrammarFlowNodesCount: existingGrammarFlowEngine?.grammarFlow?.nodes?.length || 0,
          incomingGrammarFlowNodesCount: incomingGrammarFlowEngine?.grammarFlow?.nodes?.length || 0,
        });

        // ✅ CRITICAL: Smart merge to preserve Factory data (e.g., grammarFlow)
        // If existing is Factory and has dataContract, preserve it instead of overwriting with Project version
        const existingSource = existing.source;
        const incomingSource = (template as any).source || 'Project';

        // If existing is Factory and has dataContract, merge intelligently
        if (existingSource === 'Factory' && existing.dataContract) {
          // Merge: keep Factory dataContract (which has grammarFlow), but update other fields from Project
          const merged = {
            ...template, // Start with incoming (Project) data
            source: existingSource, // Preserve Factory source
            dataContract: existing.dataContract, // CRITICAL: Preserve Factory dataContract (has grammarFlow)
            // Also preserve other Factory-specific fields that might be more recent
            ...(existing.constraints && { constraints: existing.constraints }),
            ...(existing.steps && { steps: existing.steps }),
          };
          
          // ✅ CRITICAL: Normalize engine.enabled after merge
          if (merged.dataContract?.engines && Array.isArray(merged.dataContract.engines)) {
            merged.dataContract.engines = merged.dataContract.engines.map((engine: any) => {
              if (engine.enabled === undefined || engine.enabled === null) {
                return { ...engine, enabled: true };
              }
              return engine;
            });
          }
          
          this.cache[existingIdx] = merged;

          // ✅ DEEP LOG: Verify merge result
          const mergedGrammarFlowEngine = merged.dataContract?.engines?.find((e: any) => e.type === 'grammarflow');
          const mergedHasGrammarFlow = !!mergedGrammarFlowEngine?.grammarFlow;
          console.log('[DialogueTaskService] 🔄 Merged Factory template (preserved dataContract)', {
            templateId,
            hasGrammarFlow: mergedHasGrammarFlow,
            grammarFlowNodesCount: mergedGrammarFlowEngine?.grammarFlow?.nodes?.length || 0,
            preservedFromFactory: true,
          });

          // ✅ VERIFY: Check if grammarFlow was preserved
          if (existingHasGrammarFlow && !mergedHasGrammarFlow) {
            console.error('[DialogueTaskService] ❌ GRAMMARFLOW LOST DURING MERGE!', {
              templateId,
              hadGrammarFlowBefore: existingHasGrammarFlow,
              hasGrammarFlowAfter: mergedHasGrammarFlow,
            });
          }
        } else {
          // Normal merge: preserve source, update other fields
          const merged = existingSource ? { ...template, source: existingSource } : template;
          
          // ✅ CRITICAL: Normalize engine.enabled after merge
          if (merged.dataContract?.engines && Array.isArray(merged.dataContract.engines)) {
            merged.dataContract.engines = merged.dataContract.engines.map((engine: any) => {
              if (engine.enabled === undefined || engine.enabled === null) {
                return { ...engine, enabled: true };
              }
              return engine;
            });
          }
          
          this.cache[existingIdx] = merged;

          // ✅ DEEP LOG: Verify merge result
          const mergedGrammarFlowEngine = merged.dataContract?.engines?.find((e: any) => e.type === 'grammarflow');
          const mergedHasGrammarFlow = !!mergedGrammarFlowEngine?.grammarFlow;
          console.log('[DialogueTaskService] 🔄 Normal merge completed', {
            templateId,
            existingSource,
            incomingSource,
            hasGrammarFlow: mergedHasGrammarFlow,
            grammarFlowNodesCount: mergedGrammarFlowEngine?.grammarFlow?.nodes?.length || 0,
          });

          // ✅ VERIFY: Check if grammarFlow was preserved
          if (existingHasGrammarFlow && !mergedHasGrammarFlow) {
            console.error('[DialogueTaskService] ❌ GRAMMARFLOW LOST DURING NORMAL MERGE!', {
              templateId,
              hadGrammarFlowBefore: existingHasGrammarFlow,
              hasGrammarFlowAfter: mergedHasGrammarFlow,
            });
          }
        }
        updated++;
      } else {
        this.cache.push(template);
        added++;
      }
    });

    if (!this.cacheLoaded) {
      this.cacheLoaded = true;
    }

    console.log('[DialogueTaskService] 📥 Registered external templates into cache', {
      total: templates.length,
      added,
      updated
    });

    // ✅ DEBUG: Verifica duplicati dopo la registrazione
    const duplicateIds = new Map<string, number>();
    this.cache.forEach(t => {
      const id = String(t.id || t._id || '').trim();
      if (id) {
        duplicateIds.set(id, (duplicateIds.get(id) || 0) + 1);
      }
    });

    const duplicates = Array.from(duplicateIds.entries())
      .filter(([_, count]) => count > 1);

    if (duplicates.length > 0) {
      console.error('[DialogueTaskService] ❌ DUPLICATI TROVATI DOPO REGISTRAZIONE!', {
        duplicates: duplicates.map(([id, count]) => ({ id, count })),
        totalCacheSize: this.cache.length,
        duplicateDetails: duplicates.map(([id, count]) => {
          const matchingTemplates = this.cache.filter(t => String(t.id || t._id || '').trim() === id);
          return {
            id,
            count,
            templates: matchingTemplates.map(t => ({
              id: t.id || t._id,
              label: t.label,
              name: t.name,
              type: t.type,
              templateId: t.templateId,
              source: (t as any).source
            }))
          };
        })
      });
    } else {
      console.log('[DialogueTaskService] ✅ Nessun duplicato trovato nella cache', {
        totalCacheSize: this.cache.length
      });
    }
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

    // ✅ VALIDATION: Block invalid template IDs (temporary placeholders)
    if (!templateIdStr || templateIdStr === 'root' || templateIdStr === 'UNDEFINED') {
      console.error('[DialogueTaskService] ❌ BLOCKED: Attempted to add template with invalid ID', {
        templateId: templateIdStr,
        templateLabel: template.label,
        templateName: template.name,
        templateIdType: typeof templateId,
        templateHasId: !!template.id,
        templateHas_id: !!template._id
      });
      throw new Error(`Cannot add template with invalid ID: "${templateIdStr}". Template must have a valid GUID.`);
    }

    // ✅ VALIDATION: Ensure template ID is a valid GUID (UUID format)
    const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!guidPattern.test(templateIdStr)) {
      console.error('[DialogueTaskService] ❌ BLOCKED: Attempted to add template with non-GUID ID', {
        templateId: templateIdStr,
        templateLabel: template.label,
        templateName: template.name,
        templateIdType: typeof templateId,
        templateHasId: !!template.id,
        templateHas_id: !!template._id
      });
      throw new Error(`Cannot add template with invalid ID format: "${templateIdStr}". Template ID must be a valid GUID (UUID).`);
    }

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

    // ✅ DEBUG: Verifica duplicati dopo addTemplate
    const duplicateIds = new Map<string, number>();
    this.cache.forEach(t => {
      const id = String(t.id || t._id || '').trim();
      if (id) {
        duplicateIds.set(id, (duplicateIds.get(id) || 0) + 1);
      }
    });

    const duplicates = Array.from(duplicateIds.entries())
      .filter(([_, count]) => count > 1);

    if (duplicates.length > 0) {
      console.error('[DialogueTaskService] ❌ DUPLICATI TROVATI DOPO addTemplate!', {
        addedTemplateId: templateIdStr,
        duplicates: duplicates.map(([id, count]) => ({ id, count })),
        totalCacheSize: this.cache.length
      });
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

    // ✅ DEBUG: Verifica se template.label contiene emoji
    const hasEmoji = /[\u{1F000}-\u{1F9FF}]/u.test(template.label);
    const emojiMatches = template.label.match(/[\u{1F000}-\u{1F9FF}]/gu) || [];

    if (hasEmoji) {
      console.error('[DialogueTaskService] ❌ EMOJI DETECTED IN template.label!', {
        templateId,
        label: template.label,
        labelLength: template.label.length,
        emojiCount: emojiMatches.length,
        emojis: emojiMatches,
        labelPreview: template.label.substring(0, 100)
      });
    }

    const textToSend = template.label.trim();
    console.log('[DialogueTaskService] 📤 Sending embedding request', {
      templateId,
      textLength: textToSend.length,
      textPreview: textToSend.substring(0, 50),
      hasEmoji,
      emojiCount: emojiMatches.length
    });

    try {
      // 1. Calcola embedding
      const computeResponse = await fetch('/api/embeddings/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSend })
      });

      // ✅ DEBUG: Log risposta dettagliata
      console.log('[DialogueTaskService] 📥 Embedding response received', {
        templateId,
        status: computeResponse.status,
        statusText: computeResponse.statusText,
        ok: computeResponse.ok,
        headers: Object.fromEntries(computeResponse.headers.entries())
      });

      if (!computeResponse.ok) {
        // ✅ DEBUG: Leggi il body dell'errore per vedere il messaggio dettagliato
        const errorText = await computeResponse.text();
        let errorJson;
        try {
          errorJson = JSON.parse(errorText);
        } catch {
          errorJson = { raw: errorText };
        }

        console.error('[DialogueTaskService] ❌ Embedding computation failed', {
          templateId,
          status: computeResponse.status,
          statusText: computeResponse.statusText,
          errorText: errorText.substring(0, 500),
          errorJson,
          textSent: textToSend.substring(0, 50),
          textLength: textToSend.length
        });

        throw new Error(`Failed to compute embedding: ${computeResponse.status} - ${errorJson.error || errorJson.raw || errorText}`);
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
      console.error('[DialogueTaskService] ❌ Failed to generate embedding:', {
        templateId,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        textSent: textToSend.substring(0, 50),
        textLength: textToSend.length,
        hasEmoji
      });
      // Non blocca - embedding può essere generato dopo
    }
  }
}

// Export per compatibilità
export default DialogueTaskService;

