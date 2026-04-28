/**
 * Estrae gli id LLM citati nei messaggi di validazione ElevenLabs/Pydantic (es. "Input should be 'gpt-4o', …").
 * Usare solo in combinazione con il catalogo sync (`model_id`) per evitare stringhe arbitrarie nel mapping.
 */

const INPUT_SHOULD_BE = 'input should be';

function stripApiBaseHint(tail: string): string {
  const hintIdx = tail.indexOf(' [ElevenLabs API base:');
  return hintIdx >= 0 ? tail.slice(0, hintIdx).trim() : tail;
}

/**
 * Estrae tutte le stringhe tra apici singoli dopo la prima occorrenza di "Input should be" (case-insensitive).
 */
export function extractLlmEnumQuotedIdsFromMessage(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  const idx = lower.indexOf(INPUT_SHOULD_BE);
  if (idx < 0) return [];
  let from = text.slice(idx + INPUT_SHOULD_BE.length);
  from = from.replace(/^\s*:\s*/, '').trim();
  const scan = stripApiBaseHint(from);
  const out: string[] = [];
  const re = /'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(scan)) !== null) {
    const id = m[1].trim();
    if (id && /^[a-zA-Z0-9._-]+$/.test(id)) out.push(id);
  }
  return [...new Set(out)];
}

/** True se il testo sembra l’enum LLM di ConvAI/ElevenLabs (messaggio lungo con più id tra apici). */
export function messageLooksLikeElevenLabsLlmEnumValidation(text: string): boolean {
  const ids = extractLlmEnumQuotedIdsFromMessage(text);
  if (ids.length === 0) return false;
  const t = text.toLowerCase();
  const context =
    t.includes('elevenlabs') ||
    t.includes('agents/create') ||
    t.includes('conversation_config') ||
    t.includes('"llm"') ||
    t.includes("'llm'");
  return context && ids.length >= 1;
}

function stripElevenLabsApiBaseHint(tail: string): string {
  const hintIdx = tail.indexOf(' [ElevenLabs API base:');
  return hintIdx >= 0 ? tail.slice(0, hintIdx).trim() : tail.trim();
}

function inputFromDetailPayload(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  const detail = o.detail;
  if (!Array.isArray(detail)) return null;
  for (const item of detail) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const input = row.input;
    const loc = row.loc;
    if (typeof input !== 'string' || !input.trim()) continue;
    if (!Array.isArray(loc)) continue;
    const locStr = loc.map((x) => String(x).toLowerCase());
    if (locStr.includes('llm')) return input.trim();
  }
  return null;
}

/**
 * Estrae il valore LLM non valido dal payload JSON negli errori di provision (detail[].input + loc … llm).
 */
export function extractInvalidLlmInputFromProvisionMessage(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const sep = ' — ';
  if (text.includes(sep)) {
    const tail = stripElevenLabsApiBaseHint(text.split(sep).slice(1).join(sep));
    try {
      const parsed = JSON.parse(tail);
      const hit = inputFromDetailPayload(parsed);
      if (hit) return hit;
    } catch {
      /* fall through */
    }
  }
  try {
    const parsed = JSON.parse(stripElevenLabsApiBaseHint(text));
    return inputFromDetailPayload(parsed);
  } catch {
    return null;
  }
}
