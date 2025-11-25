/**
 * PatternMemoryService
 * Service per caricare e gestire i pattern/sinonimi dalla collezione Translations
 * Supporta sia TaskTemplate che TypeTemplate (DDT)
 */

const { MongoClient } = require('mongodb');

class PatternMemoryService {
  constructor(mongoUri, dbName = 'factory') {
    this.mongoUri = mongoUri;
    this.dbName = dbName;
    this.memory = null;
    this.loaded = false;
  }

  /**
   * Carica tutti i sinonimi dalla Translations per una lingua specifica
   * @param {string} language - Lingua IDE selezionata ('it', 'en', 'pt')
   * @param {string} projectId - ID progetto (opzionale, null per factory)
   * @returns {Promise<PatternMemory>}
   */
  async loadPatterns(language, projectId = null) {
    if (this.loaded && this.memory && this.memory.language === language && this.memory.projectId === projectId) {
      return this.memory;
    }

    const client = new MongoClient(this.mongoUri);
    try {
      await client.connect();
      const db = client.db(this.dbName);
      const translationsCollection = db.collection('Translations');

      // Query per sinonimi: type='Synonyms' e lingua specificata
      const query = {
        type: 'Synonyms',
        language: language,
        $or: [
          { projectId: projectId },
          { projectId: null },
          { projectId: { $exists: false } }
        ]
      };

      if (projectId === null) {
        // Solo factory (projectId null o non esistente)
        query.$or = [
          { projectId: null },
          { projectId: { $exists: false } }
        ];
      }

      const synonymsDocs = await translationsCollection.find(query).toArray();

      // Costruisci la memory structure
      const memory = {
        language,
        projectId,
        // Map: GUID -> array di sinonimi
        templatePatterns: new Map(),
        // Map: pattern normalizzato -> Set di GUIDs (per ricerca veloce)
        patternToGuids: new Map(),
        // Map: GUID -> category (TaskTemplate o TypeTemplate)
        guidToCategory: new Map()
      };

      // Processa ogni documento
      for (const doc of synonymsDocs) {
        const guid = doc.guid;
        if (!guid) continue;

        const category = doc.category || 'TypeTemplate'; // Default a TypeTemplate
        const synonyms = doc.synonyms || [];

        // Normalizza sinonimi (rimuovi duplicati, trim, lowercase)
        const normalizedSynonyms = [...new Set(
          synonyms
            .map(s => String(s).trim().toLowerCase())
            .filter(s => s.length > 0)
        )];

        if (normalizedSynonyms.length === 0) continue;

        // Aggiungi alla memory
        memory.templatePatterns.set(guid, normalizedSynonyms);
        memory.guidToCategory.set(guid, category);

        // Build reverse index per ricerca veloce
        normalizedSynonyms.forEach(synonym => {
          const normalized = this.normalizeText(synonym);
          if (!memory.patternToGuids.has(normalized)) {
            memory.patternToGuids.set(normalized, new Set());
          }
          memory.patternToGuids.get(normalized).add(guid);
        });
      }

      this.memory = memory;
      this.loaded = true;

      console.log(`[PatternMemoryService] Caricati ${synonymsDocs.length} documenti sinonimi per lingua '${language}'`);
      console.log(`[PatternMemoryService] ${memory.templatePatterns.size} template con sinonimi`);
      console.log(`[PatternMemoryService] ${memory.patternToGuids.size} pattern unici per ricerca`);

      return memory;
    } catch (error) {
      console.error('[PatternMemoryService] Errore nel caricamento:', error);
      // Return empty memory on error
      this.memory = {
        language,
        projectId,
        templatePatterns: new Map(),
        patternToGuids: new Map(),
        guidToCategory: new Map()
      };
      return this.memory;
    } finally {
      await client.close();
    }
  }

  /**
   * Ottiene i sinonimi per un template specifico (GUID)
   * @param {string} guid - GUID del template
   * @returns {string[]} Array di sinonimi (vuoto se non trovato)
   */
  getSynonymsForTemplate(guid) {
    if (!this.memory || !this.memory.templatePatterns) {
      return [];
    }
    return this.memory.templatePatterns.get(guid) || [];
  }

  /**
   * Trova i template che corrispondono a un pattern
   * @param {string} text - Testo da cercare
   * @returns {string[]} Array di GUIDs che corrispondono
   */
  findTemplatesByPattern(text) {
    if (!this.memory || !this.memory.patternToGuids) {
      return [];
    }

    const normalized = this.normalizeText(text);
    const matchedGuids = new Set();

    // Cerca pattern che sono contenuti nel testo o viceversa
    for (const [pattern, guids] of this.memory.patternToGuids) {
      if (normalized.includes(pattern) || pattern.includes(normalized)) {
        guids.forEach(guid => matchedGuids.add(guid));
      }
    }

    return Array.from(matchedGuids);
  }

  /**
   * Normalizza testo per matching (lowercase, trim, rimuovi accenti opzionale)
   * @param {string} text
   * @returns {string}
   */
  normalizeText(text) {
    if (!text) return '';
    return String(text)
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '') // Rimuovi accenti
      .replace(/[^a-z0-9\s]/g, ' ') // Rimuovi caratteri speciali
      .replace(/\s+/g, ' ') // Normalizza spazi
      .trim();
  }

  /**
   * Resetta la cache (utile quando si cambia lingua o progetto)
   */
  reset() {
    this.memory = null;
    this.loaded = false;
  }

  /**
   * Verifica se la memory è caricata per una lingua/progetto specifico
   */
  isLoadedFor(language, projectId = null) {
    return this.loaded &&
           this.memory &&
           this.memory.language === language &&
           this.memory.projectId === projectId;
  }
}

// Singleton instance (opzionale, può essere istanziato anche direttamente)
let defaultInstance = null;

function getPatternMemoryService(mongoUri, dbName) {
  if (!defaultInstance) {
    defaultInstance = new PatternMemoryService(mongoUri, dbName);
  }
  return defaultInstance;
}

module.exports = {
  PatternMemoryService,
  getPatternMemoryService
};









