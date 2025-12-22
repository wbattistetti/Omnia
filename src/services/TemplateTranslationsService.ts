// TemplateTranslationsService.ts
// Service per gestire le traduzioni delle label dei template DDT in memoria
// Caricato all'avvio dell'app, cache in memoria per match istantaneo

export class TemplateTranslationsService {
  // Map<language, Map<templateId, translatedLabel>>
  private static labelsByLang: Map<string, Map<string, string>> = new Map();
  private static cacheLoaded = false;
  private static currentLanguage: 'it' | 'en' | 'pt' = 'it';

  /**
   * Carica tutte le traduzioni label per la lingua specificata
   */
  static async loadForLanguage(lang: 'it' | 'en' | 'pt'): Promise<void> {
    try {
      this.currentLanguage = lang;

      // Carica traduzioni dal backend per quella lingua
      const response = await fetch(`/api/factory/template-label-translations?language=${lang}`);

      if (!response.ok) {
        console.error('[TemplateTranslationsService] Errore caricamento traduzioni:', response.status);
        return;
      }

      const data = await response.json();
      // data = { templateId: translatedLabel, ... }

      const labelsMap = new Map<string, string>();
      Object.entries(data).forEach(([templateId, label]) => {
        if (typeof label === 'string') {
          labelsMap.set(templateId, label);
        }
      });

      this.labelsByLang.set(lang, labelsMap);
      this.cacheLoaded = true;

      console.log(`[TemplateTranslationsService] ✅ Caricate ${labelsMap.size} traduzioni label per lingua ${lang}`);
    } catch (error) {
      console.error('[TemplateTranslationsService] Errore nel caricamento:', error);
    }
  }

  /**
   * Ottiene la label tradotta per un template
   */
  static getLabel(templateId: string, lang?: 'it' | 'en' | 'pt'): string | null {
    const targetLang = lang || this.currentLanguage;
    return this.labelsByLang.get(targetLang)?.get(templateId) || null;
  }

  /**
   * Aggiunge o aggiorna una traduzione label in memoria
   */
  static addLabel(templateId: string, label: string, lang?: 'it' | 'en' | 'pt'): void {
    const targetLang = lang || this.currentLanguage;

    if (!this.labelsByLang.has(targetLang)) {
      this.labelsByLang.set(targetLang, new Map());
    }

    this.labelsByLang.get(targetLang)!.set(templateId, label);
    console.log(`[TemplateTranslationsService] ➕ Aggiunta label: ${templateId} → "${label}" (${targetLang})`);
  }

  /**
   * Verifica se la cache è caricata
   */
  static isCacheLoaded(): boolean {
    return this.cacheLoaded;
  }

  /**
   * Verifica se la cache è caricata per una lingua specifica
   */
  static isLoaded(lang: 'it' | 'en' | 'pt'): boolean {
    return this.labelsByLang.has(lang) && this.labelsByLang.get(lang)!.size > 0;
  }

  /**
   * Ottiene tutte le label tradotte per la lingua corrente
   * @returns Map<templateId, translatedLabel>
   */
  static getAllLabels(lang?: 'it' | 'en' | 'pt'): Map<string, string> {
    const targetLang = lang || this.currentLanguage;
    return this.labelsByLang.get(targetLang) || new Map();
  }

  /**
   * Ottiene la lingua corrente
   */
  static getCurrentLanguage(): 'it' | 'en' | 'pt' {
    return this.currentLanguage;
  }
}

export default TemplateTranslationsService;

