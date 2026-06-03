/**
 * Estrae id documenti KB collegati a un agente ConvAI dalla `conversation_config`.
 */

function pickKbEntryId(entry: unknown): string {
  if (typeof entry === 'string') return entry.trim();
  if (!entry || typeof entry !== 'object') return '';
  const o = entry as Record<string, unknown>;
  return String(o.id ?? o.document_id ?? o.documentId ?? '').trim();
}

/** Id remoti ElevenLabs in `agent.prompt.knowledge_base`. */
export function extractKnowledgeBaseDocumentIdsFromConvaiConfig(
  conversationConfig: Record<string, unknown> | null | undefined
): string[] {
  if (!conversationConfig || typeof conversationConfig !== 'object') return [];
  const agent = conversationConfig.agent;
  if (!agent || typeof agent !== 'object') return [];
  const prompt = (agent as Record<string, unknown>).prompt;
  if (!prompt || typeof prompt !== 'object') return [];
  const kb =
    (prompt as Record<string, unknown>).knowledge_base ??
    (prompt as Record<string, unknown>).knowledgeBase;
  if (!Array.isArray(kb)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of kb) {
    const id = pickKbEntryId(entry);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
