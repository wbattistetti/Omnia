import { Ear, CheckCircle2, Megaphone, GitBranch, FileText, Server, Bot } from 'lucide-react';
import { SIDEBAR_TYPE_COLORS } from '../../Sidebar/sidebarTheme';
import type { ActType } from '../../types/project';
import { taskRepository } from '../../../services/TaskRepository';
import { getTemplateId, deriveTaskTypeFromTemplateId } from '../../../utils/taskHelpers';

/**
 * ✅ NUOVO: Risolve il tipo di task dalla riga usando solo TaskRepository
 * ❌ RIMOSSO: parametro act (non esiste più il concetto di Act)
 */
export function resolveTaskType(row: any): ActType {
  // 1) Fonte primaria: row.type
  if (row?.type) {
    return row.type as ActType;
  }

  // 2) Deriva dal task usando TaskRepository (NodeRowData.taskId is separate field)
  const taskId = row?.taskId || row?.id;
  if (taskId) {
    try {
      const task = taskRepository.getTask(taskId);
      if (task) {
        const templateId = getTemplateId(task);
        const taskType = deriveTaskTypeFromTemplateId(templateId);
        if (taskType) {
          return taskType as ActType;
        }
      }
    } catch (err) {
      // Ignore
    }
  }

  // 3) Fallback: row.mode
  if (row?.mode === 'DataRequest') return 'DataRequest';
  if (row?.mode === 'DataConfirmation') return 'Summarizer';

  return 'Message'; // Default
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
    if (taskType === 'Message') {
      const hasMessage = Boolean(task?.text && task.text.trim().length > 0);
      return hasMessage;
    }

    // Per DataRequest/ProblemClassification: controlla se c'è templateId o mainData
    // ✅ Per DataRequest, permettere sempre l'apertura (può essere creato un DDT vuoto)
    if (taskType === 'DataRequest' || taskType === 'ProblemClassification') {
      // ✅ Controlla templateId (riferimento a template) o mainData (struttura diretta)
      // ✅ Per DataRequest, ritorna true anche se templateId è null (può essere creato un DDT vuoto)
      const hasTemplateId = task?.templateId && task.templateId !== 'UNDEFINED' && task.templateId !== null;
      const hasMainData = task?.mainData && task.mainData.length > 0;
      // ✅ Per DataRequest, permettere sempre l'apertura (anche con DDT vuoto)
      if (taskType === 'DataRequest') {
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
 */
export function getTaskVisualsByType(type: ActType, hasDDT: boolean) {
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
    case 'AIAgent':
      Icon = Bot;
      labelColor = purple;
      iconColor = hasDDT ? purple : gray;
      break;
    case 'DataRequest':
      Icon = Ear;
      labelColor = blue;
      iconColor = hasDDT ? blue : gray;
      break;
    case 'ProblemClassification':
      Icon = GitBranch;
      labelColor = amber;
      iconColor = hasDDT ? amber : gray;
      break;
    case 'Summarizer':
      Icon = FileText;
      labelColor = cyan;
      iconColor = hasDDT ? cyan : gray;
      break;
    case 'Negotiation':
      Icon = CheckCircle2;
      labelColor = indigo;
      iconColor = hasDDT ? indigo : gray;
      break;
    case 'BackendCall':
      Icon = Server;
      labelColor = green;
      iconColor = hasDDT ? green : gray;
      break;
    case 'Message':
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

