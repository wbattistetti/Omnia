/**
 * Snapshot task agente per runtime omnia_dialog_step (Test agente).
 * Il VB carica da Mongo; il Test flush aggiorna solo TaskRepository — questo overlay evita index stale.
 */

import {
  isKbDeterministicDeployMode,
  normalizeAgentConvaiDeployMode,
} from '@domain/convai/agentConvaiDeployMode';
import { refreshKbDialogRuntimeIndexJsonFromUseCases } from '@domain/knowledgeBase/kbDialog/kbDialogUseCaseGeneration';
import { parseAgentUseCasesJson } from '@types/aiAgentUseCases';
import type { Task } from '@types/taskTypes';

export type KbDialogAgentTaskRuntimeSnapshot = {
  id: string;
  agentKbDialogIndexJson: string;
  agentKnowledgeBaseDocumentsJson: string;
  agentConvaiDeployMode: string;
};

/** Campi minimi per KbDialogRuntimeLoader + index UC allineato al designer. */
export function buildKbDialogAgentTaskSnapshotForRuntime(
  task: Task
): KbDialogAgentTaskRuntimeSnapshot | null {
  if (!isKbDeterministicDeployMode(normalizeAgentConvaiDeployMode(task.agentConvaiDeployMode))) {
    return null;
  }
  const taskId = String(task.id ?? '').trim();
  if (!taskId) return null;

  const useCases = parseAgentUseCasesJson(String(task.agentUseCasesJson ?? ''));
  const agentKbDialogIndexJson = refreshKbDialogRuntimeIndexJsonFromUseCases(
    String(task.agentKbDialogIndexJson ?? ''),
    useCases
  );

  return {
    id: taskId,
    agentKbDialogIndexJson,
    agentKnowledgeBaseDocumentsJson: String(task.agentKnowledgeBaseDocumentsJson ?? ''),
    agentConvaiDeployMode: normalizeAgentConvaiDeployMode(task.agentConvaiDeployMode),
  };
}
