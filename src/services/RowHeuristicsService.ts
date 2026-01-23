// RowHeuristicsService.ts
// Service centralizzato per gestire le euristiche di analisi delle label delle righe
// Separa la logica di business dalla UI

import { inferTaskType } from '../nlp/taskType';
import { TaskType, taskTypeToHeuristicString } from '../types/taskTypes';
import DDTTemplateMatcherService, { type DDTTemplateMatch } from './DDTTemplateMatcherService';
import { getRuleSet, getLanguageOrder } from '../nlp/taskType/registry';
import type { CompiledCategoryPattern } from '../nlp/taskType/types';
import { waitForCache } from '../nlp/taskType/patternLoader';

export interface RowHeuristicsResult {
  taskType: TaskType;
  templateId: string | null;
  templateType: TaskType | null;
  isUndefined: boolean;
  // ✅ Categoria semantica dedotta automaticamente
  inferredCategory?: string | null;
}

/**
 * Service centralizzato per l'analisi euristica delle label delle righe
 */
export class RowHeuristicsService {
  /**
   * Analizza una label di riga usando Euristica 1 e Euristica 2
   *
   * Logica:
   * 1. Euristica 1: analizza l'inizio della label per determinare TaskType
   * 2. Euristica 2: cerca template task che matcha la label
   * 3. Override: se Euristica 1 è UNDEFINED ma Euristica 2 trova template → usa tipo del template
   * 4. Se entrambe non trovano nulla → UNDEFINED (nessun fallback automatico)
   */
  static async analyzeRowLabel(label: string): Promise<RowHeuristicsResult> {
    const trimmedLabel = label.trim();

    if (!trimmedLabel || trimmedLabel.length === 0) {
      return {
        taskType: TaskType.UNDEFINED,
        templateId: null,
        templateType: null,
        isUndefined: true
      };
    }

    // 1️⃣ EURISTICA 1: interpreta la label e decide il TaskType
    console.log('🔍 [RowHeuristics] Euristica 1 - Analisi label', { label: trimmedLabel });
    const heuristic1Result = await inferTaskType(trimmedLabel, { languageOrder: ['IT', 'EN', 'PT'] as any });
    let taskType = heuristic1Result.type;

    console.log('✅ [RowHeuristics] Euristica 1 risultato', {
      label: trimmedLabel,
      taskType,
      taskTypeName: TaskType[taskType],
      confidence: heuristic1Result.confidence,
      reasoning: heuristic1Result.reasoning || 'N/A'
    });

    // 2️⃣ EURISTICA 2: cerca template task che matcha la label
    let matchedTemplate: DDTTemplateMatch | null = null;
    let templateType: TaskType | null = null;

    if (taskType !== TaskType.UNDEFINED) {
      // Euristica 1 ha trovato un tipo → cerca template per quel tipo
      const typeForMatch = taskTypeToHeuristicString(taskType);
      console.log('🔍 [RowHeuristics] Euristica 2 - Cerca template per tipo specifico', {
        label: trimmedLabel,
        taskType,
        typeForMatch
      });

      if (typeForMatch) {
        matchedTemplate = await DDTTemplateMatcherService.findDDTTemplate(trimmedLabel, typeForMatch);
        if (matchedTemplate) {
          templateType = this.getTemplateType(matchedTemplate.template);
        }
      }
    } else {
      // Euristica 1 è UNDEFINED → cerca template generico (qualsiasi tipo)
      console.log('🔍 [RowHeuristics] Euristica 2 - Cerca template generico (Euristica 1 UNDEFINED)', {
        label: trimmedLabel
      });
      matchedTemplate = await DDTTemplateMatcherService.findDDTTemplate(trimmedLabel, null);
      if (matchedTemplate) {
        templateType = this.getTemplateType(matchedTemplate.template);
      }
    }

    console.log('✅ [RowHeuristics] Euristica 2 risultato', {
      label: trimmedLabel,
      found: !!matchedTemplate,
      templateId: matchedTemplate?.templateId || null,
      templateType: templateType ? TaskType[templateType] : null,
      templateLabel: matchedTemplate?.labelUsed || null
    });

    // 3️⃣ LOGICA DI OVERRIDE
    // - Se Euristica 1 trova tipo → usa quello (anche se Euristica 2 trova template)
    // - Se Euristica 1 è UNDEFINED ma Euristica 2 trova template → usa tipo del template
    // - Se Euristica 1 è SayMessage ma Euristica 2 trova template DataRequest → override a DataRequest
    const taskTypeBeforeOverride = taskType;

    if (matchedTemplate && templateType) {
      if (taskType === TaskType.UNDEFINED) {
        // Euristica 1 non ha trovato niente, ma Euristica 2 ha trovato template
        taskType = templateType;
        console.log('🔄 [RowHeuristics] Override: UNDEFINED → tipo template', {
          before: taskTypeBeforeOverride,
          beforeName: TaskType[taskTypeBeforeOverride],
          after: taskType,
          afterName: TaskType[taskType],
          templateId: matchedTemplate.templateId,
          templateType: TaskType[templateType]
        });
      } else if (taskType === TaskType.SayMessage && templateType === TaskType.DataRequest) {
        // Esempio: "chiedi data nascita" → Euristica 1: Message, Euristica 2: template Data
        taskType = TaskType.DataRequest;
        console.log('🔄 [RowHeuristics] Override: SayMessage → DataRequest (template trovato)', {
          before: taskTypeBeforeOverride,
          beforeName: TaskType[taskTypeBeforeOverride],
          after: taskType,
          afterName: TaskType[taskType],
          templateId: matchedTemplate.templateId
        });
      }
    }

    const isUndefined = taskType === TaskType.UNDEFINED;

    // ✅ EURISTICA 3 - Inferenza categoria semantica (solo per DataRequest)
    let inferredCategory: string | null = null;
    if (taskType === TaskType.DataRequest) {
      inferredCategory = await this.inferCategory(trimmedLabel, taskType, heuristic1Result.lang);
      if (inferredCategory) {
        console.log('✅ [RowHeuristics] Euristica 3 - Categoria dedotta', {
          label: trimmedLabel,
          inferredCategory
        });
      }
    }

    console.log('✅ [RowHeuristics] Risultato finale', {
      label: trimmedLabel,
      finalTaskType: taskType,
      finalTaskTypeName: TaskType[taskType],
      templateId: matchedTemplate?.templateId || null,
      templateType: templateType ? TaskType[templateType] : null,
      isUndefined,
      inferredCategory: inferredCategory || null
    });

    return {
      taskType,
      templateId: matchedTemplate?.templateId || null,
      templateType,
      isUndefined,
      inferredCategory
    };
  }

  /**
   * ✅ NUOVO: Infers category from label using pattern matching
   * Pattern sono caricati dal database (Heuristics["CategoryExtraction"])
   *
   * @param label - Label della riga (es. "Chiedi il motivo della chiamata")
   * @param taskType - Tipo di task (solo DataRequest)
   * @param lang - Lingua rilevata dall'euristica 1 (opzionale)
   * @returns Categoria dedotta o null se nessun pattern matcha
   */
  static async inferCategory(
    label: string,
    taskType: TaskType,
    lang?: string
  ): Promise<string | null> {
    // Solo per DataRequest
    if (taskType !== TaskType.DataRequest) {
      return null;
    }

    try {
      // Assicurati che i pattern siano caricati
      await waitForCache();

      // Determina lingua da usare (usa quella rilevata o default)
      const languageOrder = lang ? [lang.toUpperCase() as any, 'IT', 'EN', 'PT'] : ['IT', 'EN', 'PT'];
      const availableLangs = getLanguageOrder(languageOrder);

      // ✅ MIGLIORATA: Normalizzazione testo più robusta
      // Rimuove punteggiatura finale, normalizza spazi, apostrofi
      const normalizedLabel = label
        .toLowerCase()
        .trim()
        .replace(/[.,!?;:]+$/g, '') // Rimuovi punteggiatura finale
        .replace(/\s+/g, ' ') // Normalizza spazi multipli
        .replace(/[''""]/g, "'"); // Normalizza apostrofi tipografici

      // ✅ Logging iniziale per debug
      const totalPatterns = availableLangs.reduce((sum, l) => {
        const rs = getRuleSet(l);
        return sum + (rs?.CATEGORY_PATTERNS?.length || 0);
      }, 0);

      console.log('🔍 [RowHeuristics][inferCategory] Inizio analisi', {
        label,
        normalizedLabel,
        taskType: TaskType[taskType],
        lang: lang || 'default',
        availableLangs,
        totalPatterns
      });

      if (totalPatterns === 0) {
        console.warn('[RowHeuristics][inferCategory] ⚠️ Nessun pattern CATEGORY_PATTERNS disponibile in nessuna lingua!');
      }

      // Prova ogni lingua nell'ordine di priorità
      for (const currentLang of availableLangs) {
        const ruleSet = getRuleSet(currentLang);
        if (!ruleSet || !ruleSet.CATEGORY_PATTERNS || ruleSet.CATEGORY_PATTERNS.length === 0) {
          console.debug(`[RowHeuristics][inferCategory] Nessun pattern disponibile per lingua ${currentLang}`);
          continue;
        }

        // ❌ RIMOSSO: log verboso per ogni lingua testata
        // console.log(`🔍 [RowHeuristics][inferCategory] Testando ${ruleSet.CATEGORY_PATTERNS.length} pattern per lingua ${currentLang}`);

        // ✅ Testa ogni pattern (già compilato in cache)
        for (const catPattern of ruleSet.CATEGORY_PATTERNS as CompiledCategoryPattern[]) {
          try {
            // ✅ Pattern già compilato, usa direttamente
            if (catPattern.pattern.test(normalizedLabel)) {
              console.log('✅ [RowHeuristics][inferCategory] Pattern matchato', {
                label,
                normalizedLabel,
                pattern: catPattern.originalPattern,
                category: catPattern.category,
                lang: currentLang
              });
              return catPattern.category;
            }
          } catch (err) {
            // ✅ Questo non dovrebbe mai accadere se i pattern sono validati durante il caricamento
            console.error(`[RowHeuristics][inferCategory] Errore inaspettato durante test pattern: ${catPattern.originalPattern}`, err);
            continue;
          }
        }
      }

      // Nessun pattern matchato
      console.log('❌ [RowHeuristics][inferCategory] Nessun pattern matchato', {
        label,
        normalizedLabel,
        testedLangs: availableLangs
      });
      return null;
    } catch (error) {
      console.error('[RowHeuristics][inferCategory] Errore durante inferenza categoria:', error);
      return null;
    }
  }

  /**
   * Deduce TaskType dal template DialogueTask
   * I template hanno type come numero (enum) o stringa
   * ✅ PUBLIC: Usato anche in NodeRow per verificare se template è DataRequest
   */
  public static getTemplateType(template: any): TaskType {
    // Template.type può essere:
    // - numero (enum): 1 = SayMessage, 3 = DataRequest, ecc.
    // - stringa: 'DataRequest', 'Message', ecc.

    if (template.type === undefined || template.type === null) {
      return TaskType.UNDEFINED;
    }

    // Se è un numero (enum)
    if (typeof template.type === 'number') {
      // Mapping enum → TaskType (allineato con taskTypes.ts)
      // 0 = SayMessage, 1 = CloseSession, 2 = Transfer, 3 = DataRequest, 4 = BackendCall, 5 = ClassifyProblem
      if (template.type === 0) return TaskType.SayMessage;
      if (template.type === 1) return TaskType.CloseSession;
      if (template.type === 2) return TaskType.Transfer;
      if (template.type === 3) return TaskType.DataRequest;
      if (template.type === 4) return TaskType.BackendCall;
      if (template.type === 5) return TaskType.ClassifyProblem;
      // Altri mapping se necessario
      return TaskType.UNDEFINED;
    }

    // Se è una stringa
    if (typeof template.type === 'string') {
      const typeMap: Record<string, TaskType> = {
        'SayMessage': TaskType.SayMessage,
        'Message': TaskType.SayMessage,
        'DataRequest': TaskType.DataRequest,
        'GetData': TaskType.DataRequest,
        'BackendCall': TaskType.BackendCall,
        'ProblemClassification': TaskType.ClassifyProblem,
        'ClassifyProblem': TaskType.ClassifyProblem
      };
      return typeMap[template.type] || TaskType.UNDEFINED;
    }

    return TaskType.UNDEFINED;
  }
}

