// DDTPatternService.ts
// Service per gestire i pattern di matching DDT dal file di configurazione

export interface DDTPatterns {
  [templateName: string]: {
    IT?: string[];
    EN?: string[];
    PT?: string[];
  };
}

export class DDTPatternService {
  private static patterns: DDTPatterns | null = null;
  private static cacheLoaded = false;
  private static loadingPromise: Promise<DDTPatterns> | null = null;

  /**
   * Carica i pattern dal file di configurazione
   */
  static async loadPatterns(): Promise<DDTPatterns> {
    if (this.cacheLoaded && this.patterns) {
      return this.patterns;
    }

    // Se c'è già una richiesta in corso, aspetta quella
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this._loadPatternsFromFile();
    const result = await this.loadingPromise;
    this.loadingPromise = null;
    return result;
  }

  private static async _loadPatternsFromFile(): Promise<DDTPatterns> {
    try {
      const response = await fetch('/config/ddt_patterns.json');

      if (!response.ok) {
        throw new Error(`Failed to load patterns: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.patterns = data;
      this.cacheLoaded = true;
      console.log('[DDTPatternService] Pattern caricati:', Object.keys(data).length, 'template');
      return this.patterns;
    } catch (error) {
      console.error('[DDTPatternService] Errore nel caricamento dei pattern:', error);
      this.patterns = {};
      return this.patterns;
    }
  }

  /**
   * Verifica se la cache è caricata
   */
  static isCacheLoaded(): boolean {
    return this.cacheLoaded;
  }

  /**
   * Ottiene i pattern dalla cache (sincrono, se già caricati)
   */
  static getPatterns(): DDTPatterns {
    if (!this.cacheLoaded || !this.patterns) {
      console.warn('[DDTPatternService] Pattern non ancora caricati, chiamare loadPatterns() prima');
      return {};
    }
    return this.patterns;
  }

  /**
   * Trova il template che matcha il testo dato
   * @param text Testo da matchare
   * @param languages Ordine di priorità delle lingue (default: ['IT', 'EN', 'PT'])
   * @returns Nome del template che matcha, o null se nessun match
   */
  static findMatchingTemplate(text: string, languages: string[] = ['IT', 'EN', 'PT']): string | null {
    if (!this.cacheLoaded || !this.patterns) {
      return null;
    }

    const textLower = text.toLowerCase().trim();

    // Itera tutti i template
    for (const [templateName, patterns] of Object.entries(this.patterns)) {
      // Prova ogni lingua in ordine di priorità
      for (const lang of languages) {
        const langPatterns = patterns[lang as 'IT' | 'EN' | 'PT'];
        if (!Array.isArray(langPatterns)) {
          continue;
        }

        // Testa ogni pattern
        for (const patternStr of langPatterns) {
          try {
            const regex = new RegExp(patternStr, 'i');
            if (regex.test(textLower)) {
              console.log('[DDTPatternService] ✅ Match trovato:', {
                templateName,
                pattern: patternStr,
                language: lang,
                text: textLower
              });
              return templateName;
            }
          } catch (e) {
            // Pattern invalido, skip
            console.warn('[DDTPatternService] Pattern invalido:', patternStr, e);
            continue;
          }
        }
      }
    }

    return null;
  }
}

export default DDTPatternService;


