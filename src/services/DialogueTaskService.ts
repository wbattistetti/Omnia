// DialogueTaskService.ts
// Service per gestire i Task di dialogo (DDT tasks) con cache in memoria

export interface DialogueTask {
  _id?: string;
  id?: string;
  name?: string;
  label: string;
  type?: string;
  icon?: string;
  subDataIds?: string[]; // ✅ Reference ai Task sottodati (nuova struttura)
  stepPrompts?: any; // ✅ stepPrompts a root level (nuova struttura)
  dataContracts?: any[]; // Constraints
  constraints?: any[]; // Constraints (alias)
  examples?: any[];
  patterns?: {
    IT?: string[];
    EN?: string[];
    PT?: string[];
  };
  [key: string]: any;
}

export class DialogueTaskService {
  private static cache: DialogueTask[] = [];
  private static cacheLoaded = false;
  private static loadingPromise: Promise<DialogueTask[]> | null = null;

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
    return result;
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

    // Log task names for debugging
    console.log('[DialogueTaskService] Task caricati:', this.cache.length);
    console.log('[DialogueTaskService] Nomi task:', this.cache.map(t => ({
      name: t.name,
      label: t.label,
      id: t.id,
      _id: t._id,
      _idType: typeof t._id,
      _idToString: t._id ? (typeof t._id === 'object' && t._id.toString ? t._id.toString() : String(t._id)) : null,
      type: t.type
    })).slice(0, 10));
    console.log('[DialogueTaskService] Sample _id formats:', this.cache.slice(0, 5).map(t => ({
      label: t.label,
      _id: t._id,
      _idType: typeof t._id,
      _idIsObject: typeof t._id === 'object',
      _idHasToString: t._id && typeof t._id === 'object' && typeof t._id.toString === 'function'
    })));

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
      // Confronta altri campi - case-insensitive per name e label
      if (t.id && String(t.id).trim().toLowerCase() === normalizedIdLower) return true;
      if (t.name && String(t.name).trim().toLowerCase() === normalizedIdLower) return true;
      if (t.label && String(t.label).trim().toLowerCase() === normalizedIdLower) return true;
      return false;
    });

    if (!found) {
      // Log dettagliato solo la prima volta per evitare spam
      if (!this._loggedMissingIds) {
        this._loggedMissingIds = new Set();
      }
      if (!this._loggedMissingIds.has(normalizedId)) {
        this._loggedMissingIds.add(normalizedId);
        console.warn('[DialogueTaskService] ❌ Task non trovato per ID:', normalizedId);
        console.warn('[DialogueTaskService] 📋 Cache contiene', this.cache.length, 'templates');
        // Log solo primi 5 per evitare spam
        const sample = this.cache.slice(0, 5).map(t => ({
          _id: t._id ? (typeof t._id === 'object' ? t._id.toString() : String(t._id)) : null,
          id: t.id,
          name: t.name,
          label: t.label
        }));
        console.warn('[DialogueTaskService] 🔍 Sample cache (first 5):', sample);
      }
    }

    return found || null;
  }

  private static _loggedMissingIds?: Set<string>;
}

// Export per compatibilità
export default DialogueTaskService;

