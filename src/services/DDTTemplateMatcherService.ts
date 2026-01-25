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
    normalized = normalized.replace(/\b(di|del|della|dei|degli|delle|il|lo|la|l'|un|uno|una|un'|the|of|a|al|alla|ai|agli|alle)\b/gi, ' ');

    // 3. Rimuovi parole comuni (paziente, cliente, utente)
    normalized = normalized.replace(/\b(paziente|patient|cliente|customer|utente|user)\b/gi, ' ');

    // 4. Normalizza spazi multipli
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }


  /**
   * Verifica se il testo normalizzato matcha il template usando label e sinonimi euristici.
   *
   * Strategia:
   * - Normalizza il testo utente (textNormalized) e lo splitta in token.
   * - Costruisce una lista di "frasi" candidate per il template:
   *   - label normalizzata del template (templateNormalized)
   *   - ogni sinonimo euristico normalizzato dal database (cross‑lingua)
   * - Per ogni frase candidata, controlla se *tutti* i token significativi della frase
   *   compaiono nel testo utente (con match parziale token↔token).
   */
  private static scoreCandidate(
    textNormalized: string,
    templateId: string,
    language: 'it' | 'en' | 'pt'
  ): { score: number; matchedPhrase: string | null } {
    const textTokens = textNormalized.split(/\s+/).filter(Boolean).filter(t => t.length >= 3);
    if (textTokens.length === 0) {
      return { score: 0, matchedPhrase: null };
    }

    const candidatePhrases: string[] = [];
    const templateSynonyms = TemplateTranslationsService.getHeuristicsSynonyms(templateId, language);
    if (templateSynonyms && templateSynonyms.length > 0) {
      for (const syn of templateSynonyms) {
        const normalizedSyn = this.normalizeForMatch(syn);
        if (normalizedSyn && normalizedSyn.length > 0) {
          candidatePhrases.push(normalizedSyn);
        }
      }
    }

    if (candidatePhrases.length === 0) {
      return { score: 0, matchedPhrase: null };
    }

    let bestScore = 0;
    let bestPhrase: string | null = null;

    for (const phrase of candidatePhrases) {
      const phraseTokens = phrase.split(/\s+/).filter(Boolean);
      if (phraseTokens.length === 0) continue;

      let score = 0;
      let totalStrong = 0;
      let matchedStrong = 0;

      for (const token of phraseTokens) {
        if (token.length < 3) {
          continue; // ignore weak tokens
        }
        totalStrong++;
        const tokenLower = token.toLowerCase();
        const exactMatch = textTokens.some(t => t.toLowerCase() === tokenLower);
        if (exactMatch) {
          score += 3;
          matchedStrong++;
          continue;
        }

        const partialMatch = textTokens.some(t => {
          const tLower = t.toLowerCase();
          return tLower.includes(tokenLower) || tokenLower.includes(tLower);
        });
        if (partialMatch) {
          score += 1;
          matchedStrong++;
          continue;
        }

        // Strong token not matched -> penalize and invalidate this phrase
        score -= 5;
        matchedStrong = 0;
        break;
      }

      if (totalStrong > 0 && matchedStrong === totalStrong) {
        score += 2; // full phrase match bonus
      }

      if (score > bestScore) {
        bestScore = score;
        bestPhrase = phrase;
      }
    }

    return { score: bestScore, matchedPhrase: bestPhrase };
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

      // ✅ STEP 3: Verifica cache traduzioni label E sinonimi euristici
      const projectLang = (localStorage.getItem('project.lang') || 'it') as 'it' | 'en' | 'pt';
      const translationsLoaded = TemplateTranslationsService.isLoaded(projectLang);

      if (!translationsLoaded) {
        try {
          await TemplateTranslationsService.loadForLanguage(projectLang);
          await TemplateTranslationsService.loadHeuristicsSynonyms(projectLang); // Carica anche sinonimi euristici
        } catch (err) {
          console.error('[DDTTemplateMatcherService] ❌ Errore caricamento traduzioni/sinonimi:', err);
          return null;
        }
      }

      let templates = DialogueTaskService.getAllTemplates();
      if (templates.length === 0) {
        return null;
      }

      // ✅ STEP 4: Filtra template in base al tipo trovato da Euristica 1
      if (currentTaskType === 'DataRequest') {
        // ✅ SOLO enum numerico: type === 3 (TaskType.DataRequest)
        const beforeFilter = templates.length;
        templates = templates.filter(t => t.type === 3);
        const afterFilter = templates.length;
        // ❌ RIMOSSO: log verbosi di filtro e debug template
        // console.log(`[DDTTemplateMatcherService] 🔍 FILTRO DataRequest: ${beforeFilter} → ${afterFilter} template (solo type === 3)`);
      } else if (currentTaskType === 'UNDEFINED' || !currentTaskType || currentTaskType === 'Message') {
        // Se Euristica 1 ha trovato UNDEFINED o Message → cerca TUTTI i template
        // ❌ RIMOSSO: log verboso per ricerca senza filtro
        // console.log(`[DDTTemplateMatcherService] 🔍 Nessun filtro: cerca TUTTI i ${templates.length} template`);
      } else {
        // Altri tipi (BackendCall, ProblemClassification, ecc.) → non cercare template DDT
        // ❌ RIMOSSO: log verboso per skip
        // console.log(`[DDTTemplateMatcherService] ⏭️ Skip: tipo ${currentTaskType} non supporta template DDT`);
        return null;
      }

      // ✅ STEP 5: Rileva lingua del testo
      const detectedLang = this.detectLanguage(text);
      // ❌ RIMOSSO: log verboso per lingua rilevata
      // console.log(`[DDTTemplateMatcherService] 🌐 Lingua rilevata: ${detectedLang} per testo: "${text}"`);

      // ✅ STEP 6: Normalizza testo della riga nodo
      const textNormalized = this.normalizeForMatch(text);
      // ❌ RIMOSSO: log verboso per normalizzazione
      // console.log(`[DDTTemplateMatcherService] 📝 Testo normalizzato: "${text}" → "${textNormalized}"`);

      if (!textNormalized || textNormalized.length === 0) {
        // ❌ RIMOSSO: log verboso per testo vuoto
        // console.log(`[DDTTemplateMatcherService] ❌ Testo normalizzato vuoto, skip matching`);
        return null;
      }

      // ✅ STEP 7: Cerca TUTTI i match possibili e scegli quello con label più lunga
      const matches: Array<{
        template: DialogueTask;
        matchType: 'exact' | 'keywords';
        labelUsed: string;
        templateId: string;
        normalizedLabelLength: number; // Lunghezza della label normalizzata
        score: number;
        matchedPhrase: string | null;
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
          // ❌ RIMOSSO: log verboso per template senza label
          // console.log(`[DDTTemplateMatcherService] ⚠️ Template ${templateId} senza label, skip`);
          continue;
        }

        // Normalizza la label
        const templateNormalized = this.normalizeForMatch(labelUsed);
        // ❌ RIMOSSO: log verboso per ogni template testato

        // Match esatto dopo normalizzazione
        if (templateNormalized === textNormalized) {
          matches.push({
            template,
            matchType: 'exact',
            labelUsed,
            templateId,
            normalizedLabelLength: templateNormalized.length,
            score: 100,
            matchedPhrase: templateNormalized
          });
          continue; // Continua a cercare altri match
        }

        // Match per parole chiave con scoring (usa sinonimi dal database)
        const { score, matchedPhrase } = this.scoreCandidate(textNormalized, templateId, detectedLang);
        if (score > 0) {
          matches.push({
            template,
            matchType: 'keywords',
            labelUsed,
            templateId,
            normalizedLabelLength: templateNormalized.length,
            score,
            matchedPhrase
          });
        }
        // ❌ RIMOSSO: log "No match" (troppo verboso, 53 template = 53 log)
      }

      // ✅ STEP 8: Scegli il match con la label più lunga (più specifica)
      // ❌ RIMOSSO: log verboso per match totali
      // console.log(`[DDTTemplateMatcherService] 📊 Trovati ${matches.length} match totali`);

      if (matches.length === 0) {
        // ❌ RIMOSSO: log verboso per nessun match (normale, non è un errore)
        // console.log(`[DDTTemplateMatcherService] ❌ Nessun match trovato per "${textNormalized}"`);
        return null;
      }

      // ❌ RIMOSSO: log verboso per match trovati (manteniamo solo il miglior match)
      // if (matches.length > 0) {
      //   console.log(`[DDTTemplateMatcherService] 📋 Match trovati:`, matches.map(m => ({...})));
      // }

      // Ordina: prima per tipo (exact > keywords), poi per score, poi per priorità (atomic > composite), poi per lunghezza label
      matches.sort((a, b) => {
        // 1. Priorità ai match esatti
        if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
        if (a.matchType !== 'exact' && b.matchType === 'exact') return 1;

        // 2. Punteggio più alto vince
        if (a.score !== b.score) return b.score - a.score;

        // 3. Priorità ai template atomici (più specifici) rispetto ai compositi (più generici)
        const aIsAtomic = !a.template.subDataIds || a.template.subDataIds.length === 0;
        const bIsAtomic = !b.template.subDataIds || b.template.subDataIds.length === 0;
        if (aIsAtomic && !bIsAtomic) return -1; // Atomic vince su composite
        if (!aIsAtomic && bIsAtomic) return 1;  // Composite perde contro atomic

        // 4. Se stesso tipo (entrambi atomic o entrambi composite), ordina per lunghezza decrescente (vince quello con più parole)
        return b.normalizedLabelLength - a.normalizedLabelLength;
      });

      const bestMatch = matches[0];

      // ✅ TARGETED DEBUG: single log to inspect synonyms + candidates + final match
      try {
        const candidates = matches.slice(0, 20).map(m => {
          const syns = TemplateTranslationsService.getHeuristicsSynonyms(m.templateId, detectedLang);
          return {
            templateId: m.templateId,
            label: m.labelUsed,
            matchType: m.matchType,
            score: m.score,
            synonyms: syns ? syns.slice(0, 8) : [],
            matchedPhrase: m.matchedPhrase
          };
        });
        console.log('[DDT_MATCH]', {
          text: textNormalized,
          candidates,
          match: {
            templateId: bestMatch.templateId,
            label: bestMatch.labelUsed,
            matchType: bestMatch.matchType
          }
        });
      } catch { }

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

