// RowHeuristicsService.ts
// Service centralizzato per gestire le euristiche di analisi delle label delle righe
// Separa la logica di business dalla UI

import { inferTaskType } from '../nlp/taskType';
import { TaskType } from '../types/taskTypes';
import { type TaskTemplateMatch } from './TaskTemplateMatcherService';
import { getRuleSet, getLanguageOrder } from '../nlp/taskType/registry';
import type { CompiledCategoryPattern } from '../nlp/taskType/types';
import { waitForCache } from '../nlp/taskType/patternLoader';
import { separateText, segmentLabelVXY, type Language, type VXYSegmentation } from '../utils/linguisticSeparation';

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
  static async analyzeRowLabel(label: string, projectId?: string): Promise<RowHeuristicsResult> {
    const trimmedLabel = label.trim();

    if (!trimmedLabel || trimmedLabel.length === 0) {
      return {
        taskType: TaskType.UNDEFINED,
        templateId: null,
        templateType: null,
        isUndefined: true
      };
    }

    // ✅ NUOVO: Separazione linguistica (Part A = TaskType, Part B = Template)
    const language: Language = 'IT'; // TODO: Detect from project settings
    const separation = separateText(trimmedLabel, language);

    console.log('[RowHeuristicsService] 🔍 Linguistic separation', {
      original: trimmedLabel,
      partA: separation.partA,
      partB: separation.partB,
      method: separation.method
    });

    // 1️⃣ EURISTICA 1: interpreta la Part A e decide il TaskType usando embeddings
    let taskType = TaskType.UNDEFINED;
    try {
      const { EmbeddingService } = await import('./EmbeddingService');

      // ✅ Usa partA per TaskType classification (se vuota, usa full text)
      const textForTaskType = separation.partA || trimmedLabel;
      const taskTypeMatch = await EmbeddingService.findBestMatch(
        textForTaskType,
        'taskType',  // ✅ Usa embeddings TaskType invece di pattern
        0.65         // ✅ Threshold più basso per classificazione (vs 0.70 per template matching)
      );

      if (taskTypeMatch && typeof taskTypeMatch === 'object' && 'taskType' in taskTypeMatch) {
        // ✅ Match trovato con taskType
        taskType = taskTypeMatch.taskType as TaskType;
        console.log('[RowHeuristicsService] ✅ TaskType classified via embeddings', {
          label: trimmedLabel,
          partA: separation.partA,
          taskType: TaskType[taskType],
          matchedId: taskTypeMatch.id
        });
      } else {
        // ✅ Nessun match sopra soglia
        console.log('[RowHeuristicsService] ℹ️ No TaskType match found via embeddings (threshold: 0.65)', {
          label: trimmedLabel,
          partA: separation.partA
        });
      }
    } catch (error) {
      // ✅ Se embedding service non disponibile, fallback a pattern (temporaneo)
      console.warn('[RowHeuristicsService] ⚠️ Embedding service unavailable, falling back to pattern matching', {
        error: error instanceof Error ? error.message : String(error)
      });
      const heuristic1Result = await inferTaskType(trimmedLabel, { languageOrder: ['IT', 'EN', 'PT'] as any });
      taskType = heuristic1Result.type;
    }

    // 2️⃣ EURISTICA 2: cerca template task usando embedding matching (solo Part B)
    let matchedTemplate: TaskTemplateMatch | null = null;
    let templateType: TaskType | null = null;

    // ✅ NUOVO: Usa SOLO embedding matching (no fallback a matching tradizionale)
    if (taskType === TaskType.UtteranceInterpretation) {
      try {
        // ✅ V-X-Y ARCHITECTURE: Segment label into V, X, Y
        const vxySegmentation = segmentLabelVXY(trimmedLabel, language);

        console.log('[RowHeuristicsService] 🔍 V-X-Y Segmentation', {
          label: trimmedLabel,
          V: vxySegmentation.V,
          X: vxySegmentation.X,
          Y: vxySegmentation.Y,
          YSource: vxySegmentation.YSource,
        });

        // ✅ Normalize X for template matching (remove V and Y, capitalize)
        let textForTemplate = vxySegmentation.X || separation.partB || trimmedLabel;

        console.log('[RowHeuristicsService] 🔍 Before normalization', {
          label: trimmedLabel,
          vxySegmentation,
          partB: separation.partB,
          textForTemplateBeforeNormalization: textForTemplate,
        });

        // ✅ Additional normalization: use generalizeLabel for consistency
        if (vxySegmentation.X) {
          const { generalizeLabel } = await import('@TaskBuilderAIWizard/services/TemplateCreationService');
          const normalizedBefore = textForTemplate;
          textForTemplate = await generalizeLabel(textForTemplate, language);
          console.log('[RowHeuristicsService] 🔍 After generalizeLabel normalization', {
            before: normalizedBefore,
            after: textForTemplate,
            language,
          });
        }

        console.log('[RowHeuristicsService] 🔍 Starting template embedding matching', {
          label: trimmedLabel,
          vxySegmentation,
          partB: separation.partB,
          textForTemplate,
          taskType: TaskType[taskType],
          searchText: textForTemplate,
        });

        const { EmbeddingService } = await import('./EmbeddingService');

        // ✅ DEBUG: Get current project ID for loading project-specific embeddings
        let currentProjectId = projectId;
        if (!currentProjectId) {
          // ✅ FIX: Use localStorage to get projectId (same approach as ProjectDataService)
          try {
            currentProjectId = localStorage.getItem('currentProjectId') || undefined;
          } catch {
            // Fallback if localStorage not available
            currentProjectId = undefined;
          }
        }

        console.log('[RowHeuristicsService] 🔍 Loading embeddings for search', {
          searchText: textForTemplate,
          type: 'task',
          projectId: currentProjectId,
        });

        // ✅ DEBUG: Get all matches (not just best) to see what's available
        // ✅ FIX: Pass projectId to load project-specific embeddings
        const allMatches = await EmbeddingService.findAllMatches(textForTemplate, 'task', 0.0, currentProjectId); // Get all matches, no threshold

        console.log('[RowHeuristicsService] 🔍 After loading embeddings', {
          searchText: textForTemplate,
          totalMatches: allMatches.length,
        });
        console.log('[RowHeuristicsService] 🔍 All embedding matches (no threshold)', {
          searchText: textForTemplate,
          normalizedSearchText: textForTemplate,
          totalMatches: allMatches.length,
          totalEmbeddings: allMatches.length,
          top20: allMatches.slice(0, 20).map((m, idx) => ({
            rank: idx + 1,
            id: m.id,
            text: m.text,
            similarity: parseFloat(m.similarity.toFixed(3)),
            aboveThreshold: parseFloat(m.similarity.toFixed(3)) >= 0.70,
          })),
          threshold: 0.70,
        });

        // ✅ DEBUG: Check if "altezza" is in the results
        const altezzaMatches = allMatches.filter(m =>
          m.text.toLowerCase().includes('altezza') ||
          m.id.toLowerCase().includes('altezza')
        );
        console.log('[RowHeuristicsService] 🔍 Matches containing "altezza"', {
          searchText: textForTemplate,
          altezzaMatches: altezzaMatches.map(m => ({
            id: m.id,
            text: m.text,
            similarity: parseFloat(m.similarity.toFixed(3)),
          })),
        });

        const matchedTaskIdResult = await EmbeddingService.findBestMatch(textForTemplate, 'task', 0.70, currentProjectId); // ✅ FIX: Pass projectId

        // ✅ Type guard: quando type='task', restituisce string | null
        const matchedTaskId = typeof matchedTaskIdResult === 'string' ? matchedTaskIdResult : null;

        if (matchedTaskId) {
          console.log('[RowHeuristicsService] ✅ Embedding match found', {
            label: trimmedLabel,
            matchedTaskId,
            threshold: 0.70,
          });

          // Embedding ha trovato un match → usa quello
          const DialogueTaskService = (await import('./DialogueTaskService')).default;
          const template = DialogueTaskService.getTemplate(matchedTaskId);
          if (template) {
            matchedTemplate = {
              template,
              templateId: matchedTaskId,
              labelUsed: template.label,
              language: 'it', // ✅ Default language (could be enhanced to detect from label)
              matchType: 'embedding'
            };
            templateType = this.getTemplateType(template);

            console.log('[RowHeuristicsService] ✅ Template loaded from embedding match', {
              label: trimmedLabel,
              templateId: matchedTaskId,
              templateLabel: template.label,
              templateType: templateType !== null ? TaskType[templateType] : null,
            });
          } else {
            // ✅ NO FALLBACK: Template not in cache - throw error
            // This should never happen: if embedding exists, template must be in memory
            const errorMessage = `Embedding match found (ID: ${matchedTaskId}) but template is not in memory cache. This indicates a data inconsistency: the embedding exists but the corresponding template was not loaded into memory.`;
            console.error('[RowHeuristicsService] ❌ Embedding match found but template not in cache - DATA INCONSISTENCY:', {
              label: trimmedLabel,
              matchedTaskId,
              cacheSize: DialogueTaskService.getTemplateCount(),
              hint: 'This should never happen. If embedding exists, template must be in memory. This may indicate an orphan embedding (embedding without corresponding template) or a template loading issue.'
            });
            throw new Error(errorMessage);
          }
        } else {
          // ✅ NO EMBEDDING MATCH: Go directly to wizard full (no database fallback)
          console.log('[RowHeuristicsService] ℹ️ No embedding match found (threshold: 0.70) - going to wizard full', {
            label: trimmedLabel,
            threshold: 0.70,
          });
          // matchedTemplate remains null → wizard full (correct behavior)
        }
        // Se embedding non trova match → matchedTemplate rimane null → wizard full
      } catch (error) {
        // ✅ NO SILENT FALLBACK: Propagate error clearly so user knows embedding service is broken
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[RowHeuristicsService] ❌ Embedding matching failed - SERVICE ERROR:', {
          error: errorMessage,
          label: trimmedLabel,
          hint: 'The embedding service is required for template matching. Please ensure the Python FastAPI service is running.'
        });

        // Re-throw the error so it's visible to the user
        throw new Error(`Embedding service error: ${errorMessage}. Please check if the Python FastAPI service is running (npm run be:apiNew).`);
      }
    }

    // 3️⃣ LOGICA DI OVERRIDE
    // - Se Euristica 1 trova tipo → usa quello (anche se Euristica 2 trova template)
    // - Se Euristica 1 è UNDEFINED ma Euristica 2 trova template → usa tipo del template
    // - Se Euristica 1 è SayMessage ma Euristica 2 trova template DataRequest → override a DataRequest
    const taskTypeBeforeOverride = taskType;

    if (matchedTemplate && templateType) {
      if (taskType === TaskType.UNDEFINED) {
        // Euristica 1 non ha trovato niente, ma Euristica 2 ha trovato template
        taskType = templateType;
      } else if (taskType === TaskType.SayMessage && templateType === TaskType.UtteranceInterpretation) {
        // Esempio: "chiedi data nascita" → Euristica 1: Message, Euristica 2: template Data
        taskType = TaskType.UtteranceInterpretation;
      }
    }

    const isUndefined = taskType === TaskType.UNDEFINED;

    // ✅ EURISTICA 3 - Inferenza categoria semantica (solo per DataRequest)
    let inferredCategory: string | null = null;
    if (taskType === TaskType.UtteranceInterpretation) {
      // ✅ Usa la lingua dalla separazione linguistica (default 'it')
      const detectedLang = language.toLowerCase(); // 'IT' -> 'it'
      inferredCategory = await this.inferCategory(trimmedLabel, taskType, detectedLang);
    }

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
    if (taskType !== TaskType.UtteranceInterpretation) {
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

      const totalPatterns = availableLangs.reduce((sum, l) => {
        const rs = getRuleSet(l);
        return sum + (rs?.CATEGORY_PATTERNS?.length || 0);
      }, 0);

      if (totalPatterns === 0) {
        console.warn('[RowHeuristics][inferCategory] ⚠️ Nessun pattern CATEGORY_PATTERNS disponibile in nessuna lingua!');
      }

      // Prova ogni lingua nell'ordine di priorità
      for (const currentLang of availableLangs) {
        const ruleSet = getRuleSet(currentLang);
        if (!ruleSet || !ruleSet.CATEGORY_PATTERNS || ruleSet.CATEGORY_PATTERNS.length === 0) {
          continue;
        }

        // ❌ RIMOSSO: log verboso per ogni lingua testata
        // console.log(`🔍 [RowHeuristics][inferCategory] Testando ${ruleSet.CATEGORY_PATTERNS.length} pattern per lingua ${currentLang}`);

        // ✅ Testa ogni pattern (già compilato in cache)
        for (const catPattern of ruleSet.CATEGORY_PATTERNS as CompiledCategoryPattern[]) {
          try {
            // ✅ Pattern già compilato, usa direttamente
            if (catPattern.pattern.test(normalizedLabel)) {
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
    // - stringa: 'UtteranceInterpretation', 'Message', ecc.

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
      if (template.type === 3) return TaskType.UtteranceInterpretation;
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
        'UtteranceInterpretation': TaskType.UtteranceInterpretation,
        'BackendCall': TaskType.BackendCall,
        'ProblemClassification': TaskType.ClassifyProblem,
        'ClassifyProblem': TaskType.ClassifyProblem
      };
      return typeMap[template.type] || TaskType.UNDEFINED;
    }

    return TaskType.UNDEFINED;
  }
}

