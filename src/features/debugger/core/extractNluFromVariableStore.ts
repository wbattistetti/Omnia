/**
 * Estrae testi semantic / linguistic dal VariableStore SSE (chiavi = varId/slot GUID).
 * Il backend spesso serializza valori semplici (string); a volte oggetti con chiavi semantic/linguistic.
 */

function firstString(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (c == null) continue;
    const s = String(c).trim();
    if (s) return s;
  }
  return '';
}

function readStructuredSemanticLinguistic(raw: unknown): { semantic: string; linguistic: string } | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const semantic = firstString(
    o.semantic,
    o.Semantic,
    o.semanticValue,
    o.SemanticValue,
    o.value,
    o.Value
  );
  const linguistic = firstString(o.linguistic, o.Linguistic, o.linguisticValue, o.LinguisticValue);
  if (semantic || linguistic) return { semantic, linguistic };
  return null;
}

/**
 * @param store - `ExecutionState.variableStore` dall'orchestrator
 * @param utterance - testo inviato dall'utente (surface)
 */
export function extractNluFromVariableStore(
  store: Record<string, unknown> | null | undefined,
  utterance: string
): { semantic: string; linguistic: string } {
  const u = String(utterance || '').trim();

  if (!store || typeof store !== 'object') {
    return { semantic: '', linguistic: u };
  }

  for (const [, raw] of Object.entries(store)) {
    const struct = readStructuredSemanticLinguistic(raw);
    if (struct) {
      return {
        semantic: struct.semantic || u,
        linguistic: struct.linguistic || u,
      };
    }
  }

  const stringEntries: Array<{ key: string; val: string }> = [];
  for (const [key, raw] of Object.entries(store)) {
    if (raw == null) continue;
    if (typeof raw === 'string' && raw.trim()) {
      stringEntries.push({ key, val: raw.trim() });
    }
    if (typeof raw === 'number' || typeof raw === 'boolean') {
      stringEntries.push({ key, val: String(raw) });
    }
  }

  if (stringEntries.length === 0) {
    return { semantic: '', linguistic: u };
  }

  const exact = stringEntries.find((e) => e.val === u);
  if (exact) {
    return { semantic: exact.val, linguistic: u };
  }

  const last = stringEntries[stringEntries.length - 1];
  return {
    semantic: last.val,
    linguistic: u || last.val,
  };
}
