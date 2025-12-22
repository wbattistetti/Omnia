// DDTTemplateMatcherService.ts
// Service per eseguire l'Euristica 2: match fuzzy dei template DDT dalla label della riga
// Usato sia in ResponseEditor che in useNodeRowManagement quando la riga viene aggiornata

import DialogueTaskService, { type DialogueTask } from './DialogueTaskService';
import TemplateTranslationsService from './TemplateTranslationsService';

export interface DDTTemplateMatch {
  template: DialogueTask;
  templateId: string;
  labelUsed: string;
  language: 'it' | 'en' | 'pt';
  matchType: 'exact' | 'keywords';
}

export class DDTTemplateMatcherService {
  /**
   * Normalizza il testo per il matching (rimuove prefissi, articoli, stopwords)
   */
  private static normalizeForMatch(text: string): string {
    let normalized = text.toLowerCase().trim();

    // 1. Rimuovi prefissi comuni (chiedi, richiedi, ask, ecc.)
    normalized = normalized.replace(/^(chiedi|richiedi|domanda|acquisisci|raccogli|invita|ask|request|get|collect|acquire)\s+(for\s+)?/i, '');

    // 2. Rimuovi articoli e preposizioni comuni
    normalized = normalized.replace(/\b(di|del|della|dei|degli|delle|the|of|a|al|alla|ai|agli|alle)\b/gi, ' ');

    // 3. Rimuovi parole comuni (paziente, cliente, utente)
    normalized = normalized.replace(/\b(paziente|patient|cliente|customer|utente|user)\b/gi, ' ');

    // 4. Normalizza spazi multipli
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Verifica se tutte le parole chiave del template sono presenti nel testo normalizzato
   * Supporta anche sinonimi cross-lingua (date/data, birth/nascita)
   */
  private static matchByKeywords(templateNormalized: string, textNormalized: string): boolean {
    const templateWords = templateNormalized.split(/\s+/).filter(w => w.length > 0);
    const textWords = textNormalized.split(/\s+/).filter(w => w.length > 0);

    if (templateWords.length === 0) return false;

    // Mappa sinonimi cross-lingua
    const synonyms: Record<string, string[]> = {
      'date': ['data', 'date'],
      'data': ['date', 'data'],
      'birth': ['nascita', 'birth'],
      'nascita': ['birth', 'nascita']
    };

    // Tutte le parole del template devono essere presenti nel testo (o viceversa per match parziale)
    const allTemplateWordsInText = templateWords.every(word => {
      // Match diretto
      const directMatch = textWords.some(textWord =>
        textWord.includes(word) || word.includes(textWord)
      );
      if (directMatch) return true;

      // Match tramite sinonimi
      const wordLower = word.toLowerCase();
      const wordSynonyms = synonyms[wordLower] || [];
      if (wordSynonyms.length > 0) {
        return textWords.some(textWord => {
          const textWordLower = textWord.toLowerCase();
          return wordSynonyms.some(syn =>
            textWordLower.includes(syn) || syn.includes(textWordLower)
          );
        });
      }

      return false;
    });

    return allTemplateWordsInText;
  }

  /**
   * Rileva la lingua del testo
   */
  private static detectLanguage(text: string): 'it' | 'en' | 'pt' {
    const textLower = text.toLowerCase();
    if (/\b(chiedi|richiedi|domanda|acquisisci|raccogli|invita|dati|nome|cognome|indirizzo|telefono|email|nascita|paziente|cliente|scadenza)\b/.test(textLower)) {
      return 'it';
    }
    if (/\b(pedir|solicitar|pergunta|obter|coletar|dados|nome|sobrenome|endereco|telefone|nascimento|paciente|cliente|validade)\b/.test(textLower)) {
      return 'pt';
    }
    return 'en';
  }

  /**
   * Trova un template DDT che matcha con il testo fornito
   *
   * @param text - Testo della label della riga
   * @param currentTaskType - Tipo corrente del task (se UNDEFINED, cerca template DDT)
   * @returns Match trovato o null
   */
  static async findDDTTemplate(
    text: string,
    currentTaskType?: string
  ): Promise<DDTTemplateMatch | null> {
    try {
      // ✅ STEP 1: Verifica cache template
      if (!DialogueTaskService.isCacheLoaded()) {
        return null;
      }

      // ✅ STEP 2: Se il tipo è già DataRequest, non cercare (già corretto)
      // ✅ Accetta anche UNDEFINED e Message (Message è il default, può essere sovrascritto)
      if (currentTaskType && currentTaskType !== 'UNDEFINED' && currentTaskType !== 'DataRequest' && currentTaskType !== 'Message') {
        return null;
      }

      // ✅ STEP 3: Verifica cache traduzioni label
      const projectLang = (localStorage.getItem('project.lang') || 'it') as 'it' | 'en' | 'pt';
      const translationsLoaded = TemplateTranslationsService.isLoaded(projectLang);

      if (!translationsLoaded) {
        try {
          await TemplateTranslationsService.loadForLanguage(projectLang);
        } catch (err) {
          console.error('[DDTTemplateMatcherService] ❌ Errore caricamento traduzioni:', err);
          return null;
        }
      }

      let templates = DialogueTaskService.getAllTemplates();
      if (templates.length === 0) {
        return null;
      }

      // ✅ STEP 4: Filtra template in base al tipo trovato da Euristica 1
      if (currentTaskType === 'DataRequest') {
        // Se Euristica 1 ha trovato DataRequest → cerca SOLO template di tipo DataRequest
        templates = templates.filter(t => {
          const templateType = t.type;
          return (
            templateType === 3 || // Enum numerico TaskType.GetData
            templateType === 'datarequest' ||
            templateType === 'data' || // Legacy
            t.name?.toLowerCase() === 'datarequest' ||
            t.name?.toLowerCase() === 'getdata' ||
            t.name?.toLowerCase() === 'data' ||
            t.taskType?.toLowerCase() === 'datarequest'
          );
        });
      } else if (currentTaskType === 'UNDEFINED' || !currentTaskType || currentTaskType === 'Message') {
        // Se Euristica 1 ha trovato UNDEFINED o Message → cerca TUTTI i template
      } else {
        // Altri tipi (BackendCall, ProblemClassification, ecc.) → non cercare template DDT
        return null;
      }

      // ✅ STEP 5: Rileva lingua del testo
      const detectedLang = this.detectLanguage(text);

      // ✅ STEP 6: Normalizza testo della riga nodo
      const textNormalized = this.normalizeForMatch(text);

      if (!textNormalized || textNormalized.length === 0) {
        return null;
      }

      // ✅ STEP 7: Cerca TUTTI i match possibili e scegli quello con label più lunga
      const matches: Array<{
        template: DialogueTask;
        matchType: 'exact' | 'keywords';
        labelUsed: string;
        templateId: string;
        normalizedLabelLength: number; // Lunghezza della label normalizzata
      }> = [];

      for (const template of templates) {
        const templateId = template.id || template._id?.toString() || '';
        if (!templateId) {
          continue;
        }

        // ✅ Ottieni label tradotta dalla cache in memoria
        const translatedLabel = TemplateTranslationsService.getLabel(templateId, detectedLang);
        const originalLabel = template.label || 'N/A';
        const labelUsed = translatedLabel || originalLabel;

        if (!labelUsed) {
          continue;
        }

        // Normalizza la label
        const templateNormalized = this.normalizeForMatch(labelUsed);

        // Match esatto dopo normalizzazione
        if (templateNormalized === textNormalized) {
          matches.push({
            template,
            matchType: 'exact',
            labelUsed,
            templateId,
            normalizedLabelLength: templateNormalized.length
          });
          continue; // Continua a cercare altri match
        }

        // Match per parole chiave
        if (this.matchByKeywords(templateNormalized, textNormalized)) {
          matches.push({
            template,
            matchType: 'keywords',
            labelUsed,
            templateId,
            normalizedLabelLength: templateNormalized.length
          });
        }
      }

      // ✅ STEP 8: Scegli il match con la label più lunga (più specifica)
      if (matches.length === 0) {
        return null;
      }

      // Ordina: prima per tipo (exact > keywords), poi per lunghezza label decrescente
      matches.sort((a, b) => {
        // Priorità ai match esatti
        if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
        if (a.matchType !== 'exact' && b.matchType === 'exact') return 1;
        // Se stesso tipo, ordina per lunghezza decrescente
        return b.normalizedLabelLength - a.normalizedLabelLength;
      });

      const bestMatch = matches[0];

      return {
        template: bestMatch.template,
        templateId: bestMatch.templateId,
        labelUsed: bestMatch.labelUsed,
        language: detectedLang,
        matchType: bestMatch.matchType
      };
    } catch (error) {
      console.error('[DDTTemplateMatcherService] ❌ Errore in findDDTTemplate:', error);
      return null;
    }
  }
}

export default DDTTemplateMatcherService;

