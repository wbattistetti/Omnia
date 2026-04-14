import {
  Ear,
  CheckCircle2,
  Megaphone,
  GitBranch,
  FileText,
  Server,
  Bot,
  List,
  CheckCircle,
  Workflow,
  MessageCircleQuestion,
} from 'lucide-react';
import { taskRepository } from '../../../services/TaskRepository';
import { getSayMessageSyncedBody } from '../../../utils/sayMessageTaskSync';
import { TaskType, normalizeLegacyTaskTypeValue } from '../../../types/taskTypes';
import { PRESET_CATEGORIES } from '../../../utils/categoryPresets';

/** Preset row categories must not recolor unrelated task types (e.g. Subflow vs SayMessage presets). */
const SAY_MESSAGE_PRESET_IDS = new Set(['greeting', 'farewell', 'info-short', 'info-long']);
const DATA_OR_CLASSIFY_PRESET_IDS = new Set(['problem-classification', 'choice', 'confirmation']);

function isPresetCategoryApplicableToTaskType(category: string, type: TaskType): boolean {
  if (!category || !PRESET_CATEGORIES[category]) return false;
  if (SAY_MESSAGE_PRESET_IDS.has(category)) return type === TaskType.SayMessage;
  if (DATA_OR_CLASSIFY_PRESET_IDS.has(category)) {
    return type === TaskType.UtteranceInterpretation || type === TaskType.ClassifyProblem;
  }
  return false;
}
import getIconComponent from '../../TaskEditor/ResponseEditor/icons';
import { getGlobalResolver } from '@domain/taskContent/TaskContentResolver.config';
import {
  FLOWCHART_INACTIVE_ICON_GRAY,
  getFlowchartTaskTypeLabelColor,
} from './flowchartTaskTypeColors';

// ✅ Tipo per custom category (da TODO_NUOVO.md)
export interface CustomCategory {
  id: string;
  label: string;
  icon: string; // Nome icona Lucide o custom
  color: string;
  description?: string;
  scope: 'project' | 'global';
}

/**
 * ✅ NUOVO: Risolve il tipo di task dalla riga usando solo TaskRepository
 * ✅ Restituisce TaskType enum invece di stringa semantica
 */
export function resolveTaskType(row: any): TaskType {
  // 1) Fonte primaria: row.heuristics.type (dati dall'euristica - lazy task creation)
  const rowHeuristics = (row as any)?.heuristics;
  if (rowHeuristics?.type !== undefined && rowHeuristics?.type !== null) {
    // Se è un numero (TaskType enum), restituiscilo direttamente
    if (typeof rowHeuristics.type === 'number') {
      return rowHeuristics.type as TaskType;
    }
  }

  // 2) ❌ LEGACY: row.type (backward compatibility temporanea - da rimuovere)
  // TODO: Rimuovere questa fonte dopo migrazione completa a row.heuristics.type
  if (row?.type !== undefined && row?.type !== null) {
    // Se è un numero (TaskType enum), restituiscilo direttamente
    if (typeof row.type === 'number') {
      return normalizeLegacyTaskTypeValue(row.type);
    }
    // Se è una stringa legacy, convertila (backward compatibility temporanea)
    if (typeof row.type === 'string') {
      const typeMap: Record<string, TaskType> = {
        'Message': TaskType.SayMessage,
        'UtteranceInterpretation': TaskType.UtteranceInterpretation,
        'BackendCall': TaskType.BackendCall,
        'ProblemClassification': TaskType.ClassifyProblem,
        'AIAgent': TaskType.AIAgent,
        'Summarizer': TaskType.Summarizer,
        'Negotiation': TaskType.Negotiation,
        'FaqAnswering': TaskType.FaqAnswering,
        'Flow': TaskType.Subflow,
        'Subflow': TaskType.Subflow
      };
      return typeMap[row.type] ?? TaskType.UNDEFINED;
    }
  }

  // 3) Deriva dal task usando TaskRepository (row.id === task.id ALWAYS)
  const taskId = row?.id;
  if (taskId) {
    try {
      const task = taskRepository.getTask(taskId);
      if (task) {
        // Persisted enum may use legacy `9` → Subflow (aligned with VB / useNodeRowVisuals)
        if (task.type !== undefined && task.type !== null) {
          return normalizeLegacyTaskTypeValue(task.type as number);
        }

        // ✅ Log solo se il task esiste ma non ha type
        console.warn('[🔍 RESOLVE_TYPE] Task has no type', { taskId });
      } else {
        // ✅ Task non trovato è normale per lazy creation - non loggare
      }
    } catch (err) {
      console.error('[🔍 RESOLVE_TYPE] Error', { taskId, error: err });
    }
  }

  // L'utente deve scegliere manualmente il tipo se l'euristica non ha trovato niente

  // 5) Default: UNDEFINED (mostra punto interrogativo)
  return TaskType.UNDEFINED;
}

/**
 * Controlla se il task ha un TaskTree usando TaskContentResolver
 * ✅ NEW: Uses centralized domain service (independent of task type)
 */
export function hasTaskTree(row: any): boolean {
  // ✅ UNIFIED MODEL: row.id === task.id ALWAYS (when task exists)
  const taskId = row?.id;

  if (!taskId) {
    return false;
  }

  try {
    const taskType = resolveTaskType(row);

    // ✅ NEW: Use TaskContentResolver (centralized logic, independent of task type)
    const resolver = getGlobalResolver();
    return resolver.hasTaskTree(taskId, taskType);
  } catch (err) {
    // ✅ Fallback to legacy logic if resolver not available (during migration)
    console.warn('[hasTaskTree] Resolver not available, using legacy logic', err);
    return hasTaskTreeLegacy(row);
  }
}

/**
 * ✅ LEGACY: Maintained for backward compatibility during migration
 * TODO: Remove after complete migration to TaskContentResolver
 */
function hasTaskTreeLegacy(row: any): boolean {
  const taskId = row?.id;

  if (!taskId) {
    return false;
  }

  try {
    const task = taskRepository.getTask(taskId);
    if (!task) {
      return false;
    }

    const taskType = resolveTaskType(row);

    // Per Message: controlla se c'è un messaggio
    if (taskType === TaskType.SayMessage) {
      return getSayMessageSyncedBody(task).trim().length > 0;
    }

    // Per DataRequest/ProblemClassification: controlla se c'è templateId o data
    // ✅ Per DataRequest, permettere sempre l'apertura (può essere creato un TaskTree vuoto)
    if (taskType === TaskType.UtteranceInterpretation || taskType === TaskType.ClassifyProblem) {
      // ✅ Controlla templateId (riferimento a template) o data (struttura diretta)
      // ✅ Per DataRequest, ritorna true anche se templateId è null (può essere creato un TaskTree vuoto)
      const hasTemplateId = task?.templateId && task.templateId !== 'UNDEFINED' && task.templateId !== null;
      const hasdata = task?.data && task.data.length > 0;
      // ✅ Per DataRequest, permettere sempre l'apertura (anche con TaskTree vuoto)
      if (taskType === TaskType.UtteranceInterpretation) {
        return true; // ✅ Sempre permesso per DataRequest (può essere creato un TaskTree vuoto)
      }
      // Per ProblemClassification, richiedi templateId o data
      return Boolean(hasTemplateId || hasdata);
    }

    // Per altri tipi: controlla se c'è contenuto rilevante
    return Boolean(
      task?.endpoint ||
        (Array.isArray(task?.semanticValues) && task.semanticValues.length > 0)
    );
  } catch (err) {
    return false;
  }
}

/**
 * Restituisce icona e colori per un tipo di task
 * ✅ Accetta TaskType enum invece di ActType stringa
 *
 * ✅ TODO FUTURO: Category System (vedi documentation/TODO_NUOVO.md)
 * Estendere questa funzione a getTaskVisuals(type, category?, customCategory?, hasTaskTree?)
 * per supportare preset categories e custom categories.
 * Priorità: customCategory > preset category > base type
 */
export function getTaskVisualsByType(type: TaskType, hasTaskTree: boolean) {
  const gray = FLOWCHART_INACTIVE_ICON_GRAY;
  const labelColor = getFlowchartTaskTypeLabelColor(type);

  let Icon: any = Megaphone;
  switch (type) {
    case TaskType.AIAgent:
      Icon = Bot;
      break;
    case TaskType.UtteranceInterpretation:
      Icon = Ear;
      break;
    case TaskType.ClassifyProblem:
      Icon = GitBranch;
      break;
    case TaskType.Summarizer:
      Icon = FileText;
      break;
    case TaskType.Negotiation:
      Icon = CheckCircle2;
      break;
    case TaskType.FaqAnswering:
      Icon = MessageCircleQuestion;
      break;
    case TaskType.BackendCall:
      Icon = Server;
      break;
    case TaskType.Subflow:
      Icon = Workflow;
      break;
    case TaskType.SayMessage:
    default:
      Icon = Megaphone;
  }

  const iconColor = hasTaskTree ? labelColor : gray;

  return {
    Icon,
    labelColor,
    iconColor,
    color: labelColor
  };
}

/**
 * ✅ NUOVO: getTaskVisuals con supporto per categorie semantiche
 * Restituisce icona e colori per un task considerando:
 * 1. Custom category (priorità massima)
 * 2. Preset category
 * 3. Base type (fallback)
 *
 * @param type - TaskType enum
 * @param category - ID categoria preset (opzionale)
 * @param customCategory - Custom category object (opzionale)
 * @param hasTaskTree - Se il task ha un TaskTree
 * @returns Oggetto con Icon, labelColor, iconColor
 */
export function getTaskVisuals(
  type: TaskType,
  category?: string,
  customCategory?: CustomCategory,
  hasTaskTree?: boolean
) {
  // ✅ Priorità 1: Custom category (ha la precedenza)
  if (customCategory) {
    return {
      Icon: getIconComponent(customCategory.icon) as any,
      labelColor: customCategory.color,
      iconColor: customCategory.color,
      color: customCategory.color
    };
  }

  // ✅ Priorità 2: Preset category (only when the preset matches the task type)
  if (category && PRESET_CATEGORIES[category] && isPresetCategoryApplicableToTaskType(category, type)) {
    const preset = PRESET_CATEGORIES[category];
    // Usa l'icona Lucide direttamente (non getIconComponent per icone standard)
    let Icon: any;
    switch (preset.icons.icon) {
      case 'GitBranch':
        Icon = GitBranch;
        break;
      case 'List':
        Icon = List;
        break;
      case 'CheckCircle':
        Icon = CheckCircle;
        break;
      case 'Sun':
        Icon = Megaphone; // Fallback temporaneo
        break;
      case 'Wave':
        Icon = Megaphone; // Fallback temporaneo
        break;
      case 'MessageSquare':
        Icon = Megaphone; // Fallback temporaneo
        break;
      default:
        // Prova con getIconComponent per icone custom
        Icon = getIconComponent(preset.icons.icon) as any;
    }
    return {
      Icon,
      labelColor: preset.icons.color,
      iconColor: preset.icons.color,
      color: preset.icons.color
    };
  }

  // ✅ Priorità 3: Base da type (senza categoria)
  return getTaskVisualsByType(type, hasTaskTree ?? false);
}
