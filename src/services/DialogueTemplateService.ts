// DialogueTemplateService.ts
// Service per gestire i template di dialogo (DDT templates) con cache in memoria

export interface DialogueTemplate {
  _id?: string;
  id?: string;
  name?: string;
  label: string;
  type?: string;
  icon?: string;
  subDataIds?: string[]; // ✅ Reference ai template sottodati (nuova struttura)
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

export class DialogueTemplateService {
  private static cache: DialogueTemplate[] = [];
  private static cacheLoaded = false;
  private static loadingPromise: Promise<DialogueTemplate[]> | null = null;

  /**
   * Carica tutti i template dal database Factory
   */
  static async loadTemplates(): Promise<DialogueTemplate[]> {
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

  private static async _loadTemplatesFromAPI(): Promise<DialogueTemplate[]> {
    try {
      const response = await fetch('/api/factory/dialogue-templates');

      if (!response.ok) {
        throw new Error(`Failed to load templates: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.cache = Array.isArray(data) ? data : [];
      this.cacheLoaded = true;
      return this.cache;
    } catch (error) {
      console.error('[DialogueTemplateService] Errore nel caricamento dei template:', error);
      this.cache = [];
      return this.cache;
    }
  }

  /**
   * Ottiene tutti i template dalla cache (sincrono, se già caricati)
   */
  static getAllTemplates(): DialogueTemplate[] {
    if (!this.cacheLoaded) {
      console.warn('[DialogueTemplateService] Cache non ancora caricata, chiamare loadTemplates() prima');
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
   * Ottiene il numero di template caricati
   */
  static getTemplateCount(): number {
    return this.cache.length;
  }

  /**
   * Ottiene un template per ID (dalla cache)
   * Supporta ObjectId MongoDB (come stringa o oggetto) e confronto per _id, id, name, label
   */
  static getTemplate(id: string): DialogueTemplate | null {
    if (!this.cacheLoaded) {
      console.warn('[DialogueTemplateService] Cache non ancora caricata, chiamare loadTemplates() prima');
      return null;
    }

    // Normalizza l'ID cercato (potrebbe essere ObjectId come stringa)
    const normalizedId = String(id).trim();

    // Cerca nella cache
    const found = this.cache.find(t => {
      // Confronta _id (potrebbe essere ObjectId o stringa)
      if (t._id) {
        const tId = String(t._id).trim();
        if (tId === normalizedId) return true;
        // Se entrambi sono ObjectId-like (24 caratteri hex), confronta senza case
        if (tId.length === 24 && normalizedId.length === 24 && /^[0-9a-fA-F]{24}$/.test(tId) && /^[0-9a-fA-F]{24}$/.test(normalizedId)) {
          if (tId.toLowerCase() === normalizedId.toLowerCase()) return true;
        }
      }
      // Confronta altri campi
      if (t.id && String(t.id).trim() === normalizedId) return true;
      if (t.name && String(t.name).trim() === normalizedId) return true;
      if (t.label && String(t.label).trim() === normalizedId) return true;
      return false;
    });

    if (!found) {
      console.warn('[DialogueTemplateService] Template non trovato per ID:', {
        searchedId: normalizedId,
        cacheSize: this.cache.length,
        sampleIds: this.cache.slice(0, 5).map(t => ({
          _id: t._id ? String(t._id) : null,
          id: t.id,
          name: t.name,
          label: t.label
        }))
      });
    }

    return found || null;
  }
}

// Export per compatibilità
export default DialogueTemplateService;

