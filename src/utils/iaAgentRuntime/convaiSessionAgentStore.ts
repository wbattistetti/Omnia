/**
 * ConvAI ElevenLabs `agent_id` per task: solo memoria (tab/session), mai persistito nel DB.
 * Usato da compile e provisioning pre-run; si azzera al reload pagina.
 */

export type ConvaiSessionBinding = {
  agentId: string;
  /** Chiave semplice per sapere se serve nuovo create (prompt + voci rilevanti ConvAI). */
  lastProvisionKey: string;
};

const bindings = new Map<string, ConvaiSessionBinding>();

export function getConvaiSessionBinding(taskId: string): ConvaiSessionBinding | undefined {
  const k = String(taskId || '').trim();
  if (!k) return undefined;
  return bindings.get(k);
}

export function setConvaiSessionBinding(taskId: string, agentId: string, lastProvisionKey: string): void {
  const k = String(taskId || '').trim();
  if (!k || !String(agentId || '').trim()) return;
  bindings.set(k, { agentId: agentId.trim(), lastProvisionKey });
}

export function clearConvaiSessionBinding(taskId: string): void {
  const k = String(taskId || '').trim();
  if (!k) return;
  bindings.delete(k);
}

/** Solo test / diagnostica. */
export function clearAllConvaiSessionBindings(): void {
  bindings.clear();
}
