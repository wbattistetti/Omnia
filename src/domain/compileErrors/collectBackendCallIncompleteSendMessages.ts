/**
 * Messaggi di errore quando righe SEND non hanno campo API e/o binding costante|variabile (compile-time).
 */

import { TaskType, type Task } from '../../types/taskTypes';

/** internalName delle righe SEND ancora da completare (campo API e/o binding). */
export function listIncompleteBackendSendWireKeys(task: Task): string[] {
  if (task.type !== TaskType.BackendCall) return [];
  const inputs =
    (task as Task & { inputs?: Array<{ internalName?: string; apiParam?: string; variable?: string }> }).inputs ?? [];
  const keys: string[] = [];
  for (const row of inputs) {
    const iname = row.internalName?.trim();
    if (!iname) continue;
    const api = row.apiParam?.trim();
    const variable = row.variable?.trim();
    if (!api || !variable) keys.push(iname);
  }
  return keys;
}

export function collectBackendCallIncompleteSendMessages(task: Task): string[] {
  if (task.type !== TaskType.BackendCall) return [];
  const inputs =
    (task as Task & { inputs?: Array<{ internalName?: string; apiParam?: string; variable?: string }> }).inputs ?? [];
  const msgs: string[] = [];
  for (const row of inputs) {
    const iname = row.internalName?.trim();
    if (!iname) continue;
    const api = row.apiParam?.trim();
    const variable = row.variable?.trim();
    if (!api && !variable) {
      msgs.push(`Backend Call · SEND «${iname}»: mappa il campo API e indica costante o variabile.`);
    } else if (!api) {
      msgs.push(`Backend Call · SEND «${iname}»: mappa il campo API (nome parametro OpenAPI).`);
    } else if (!variable) {
      msgs.push(
        `Backend Call · SEND «${iname}» (${api}): obbligatorio costante o variabile di flusso — nessun default implicito.`
      );
    }
  }
  return msgs;
}
