import { Ear, CheckCircle2, Megaphone, GitBranch, FileText, Server, Bot } from 'lucide-react';
import { SIDEBAR_TYPE_COLORS } from '../../Sidebar/sidebarTheme';
import { taskRepository } from '../../../services/TaskRepository';
import { TaskType } from '../../../types/taskTypes';

/**
 * ✅ NUOVO: Risolve il tipo di task dalla riga usando solo TaskRepository
 * ✅ Restituisce TaskType enum invece di stringa semantica
 */
export function resolveTaskType(row: any): TaskType {
  // 1) Fonte primaria: row.meta.type (metadati dall'euristica - lazy task creation)
  const rowMeta = (row as any)?.meta;
  if (rowMeta?.type !== undefined && rowMeta?.type !== null) {
    // Se è un numero (TaskType enum), restituiscilo direttamente
    if (typeof rowMeta.type === 'number') {
      return rowMeta.type as TaskType;
    }
  }

  // 2) Fonte secondaria: row.type (se è già TaskType enum)
  if (row?.type !== undefined && row?.type !== null) {
    // Se è un numero (TaskType enum), restituiscilo direttamente
    if (typeof row.type === 'number') {
      return row.type as TaskType;
    }
    // Se è una stringa legacy, convertila (backward compatibility temporanea)
    if (typeof row.type === 'string') {
      const typeMap: Record<string, TaskType> = {
        'Message': TaskType.SayMessage,
        'DataRequest': TaskType.DataRequest,
        'BackendCall': TaskType.BackendCall,
        'ProblemClassification': TaskType.ClassifyProblem,
        'AIAgent': TaskType.AIAgent,
        'Summarizer': TaskType.Summarizer,
        'Negotiation': TaskType.Negotiation
      };
      // ❌ RIMOSSO FALLBACK: se non è nel map, restituisci UNDEFINED (nessun fallback automatico)
      return typeMap[row.type] ?? TaskType.UNDEFINED;
    }
  }

  // 3) Deriva dal task usando TaskRepository (NodeRowData.taskId is separate field)
  const taskId = row?.taskId || row?.id;
  if (taskId) {
    try {
      const task = taskRepository.getTask(taskId);
      if (task) {
        // ✅ Usa direttamente task.type (TaskType enum) invece di convertire
        if (task.type !== undefined && task.type !== null) {
          return task.type as TaskType;
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

  // ❌ RIMOSSO: Fallback da row.mode - se l'euristica non ha trovato niente, resta UNDEFINED
  // L'utente deve scegliere manualmente il tipo

  // 5) Default: UNDEFINED (mostra punto interrogativo)
  return TaskType.UNDEFINED;
}

/**
 * ✅ NUOVO: Controlla se il task ha un DDT usando solo TaskRepository
 * ❌ RIMOSSO: parametro act (non esiste più il concetto di Act)
 */
export function hasTaskDDT(row: any): boolean {
  // NodeRowData.taskId is separate field, not Task.taskId
  const taskId = row?.taskId || row?.id;

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
      const hasMessage = Boolean(task?.text && task.text.trim().length > 0);
      return hasMessage;
    }

    // Per DataRequest/ProblemClassification: controlla se c'è templateId o mainData
    // ✅ Per DataRequest, permettere sempre l'apertura (può essere creato un DDT vuoto)
    if (taskType === TaskType.DataRequest || taskType === TaskType.ClassifyProblem) {
      // ✅ Controlla templateId (riferimento a template) o mainData (struttura diretta)
      // ✅ Per DataRequest, ritorna true anche se templateId è null (può essere creato un DDT vuoto)
      const hasTemplateId = task?.templateId && task.templateId !== 'UNDEFINED' && task.templateId !== null;
      const hasMainData = task?.mainData && task.mainData.length > 0;
      // ✅ Per DataRequest, permettere sempre l'apertura (anche con DDT vuoto)
      if (taskType === TaskType.DataRequest) {
        return true; // ✅ Sempre permesso per DataRequest (può essere creato un DDT vuoto)
      }
      // Per ProblemClassification, richiedi templateId o mainData
      return Boolean(hasTemplateId || hasMainData);
    }

    // Per altri tipi: controlla se c'è contenuto rilevante
    return Boolean(task?.text || task?.endpoint || task?.intents);
  } catch (err) {
    return false;
  }
}

/**
 * ✅ RINOMINATO: getTaskVisualsByType (era getAgentActVisualsByType)
 * Restituisce icona e colori per un tipo di task
 * ✅ Accetta TaskType enum invece di ActType stringa
 */
export function getTaskVisualsByType(type: TaskType, hasDDT: boolean) {
  const green = '#22c55e';
  const blue = '#3b82f6';
  const indigo = '#6366f1';
  const amber = '#f59e0b';
  const cyan = '#06b6d4';
  const gray = '#94a3b8';
  const purple = '#a855f7';

  let Icon: any = Megaphone;
  let labelColor = green;
  let iconColor = gray;

  switch (type) {
    case TaskType.AIAgent:
      Icon = Bot;
      labelColor = purple;
      iconColor = hasDDT ? purple : gray;
      break;
    case TaskType.DataRequest:
      Icon = Ear;
      labelColor = blue;
      iconColor = hasDDT ? blue : gray;
      break;
    case TaskType.ClassifyProblem:
      Icon = GitBranch;
      labelColor = amber;
      iconColor = hasDDT ? amber : gray;
      break;
    case TaskType.Summarizer:
      Icon = FileText;
      labelColor = cyan;
      iconColor = hasDDT ? cyan : gray;
      break;
    case TaskType.Negotiation:
      Icon = CheckCircle2;
      labelColor = indigo;
      iconColor = hasDDT ? indigo : gray;
      break;
    case TaskType.BackendCall:
      Icon = Server;
      labelColor = green;
      iconColor = hasDDT ? green : gray;
      break;
    case TaskType.SayMessage:
    default:
      Icon = Megaphone;
      labelColor = green;
      iconColor = hasDDT ? green : gray;
  }

  return {
    Icon,
    labelColor,
    iconColor,
    color: labelColor
  };
}

