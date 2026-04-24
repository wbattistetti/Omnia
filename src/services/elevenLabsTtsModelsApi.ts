/**
 * Lista modelli TTS ElevenLabs (`eleven_*`) via ApiServer GET /elevenlabs/tts-models → proxy GET /v1/models.
 */

export type ElevenLabsTtsModelRow = {
  model_id: string;
  name: string;
};

export async function fetchElevenLabsTtsModels(): Promise<ElevenLabsTtsModelRow[]> {
  const res = await fetch('/elevenlabs/tts-models', { method: 'GET' });
  const text = await res.text();
  let data: { models?: unknown } = {};
  try {
    data = text.trim() ? (JSON.parse(text) as { models?: unknown }) : {};
  } catch {
    throw new Error(`tts-models: JSON non valido (HTTP ${res.status})`);
  }
  if (!res.ok) {
    const err = typeof (data as { error?: string }).error === 'string' ? (data as { error: string }).error : `HTTP ${res.status}`;
    throw new Error(err);
  }
  const raw = data.models;
  if (!Array.isArray(raw)) return [];
  const out: ElevenLabsTtsModelRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.model_id === 'string' ? r.model_id.trim() : '';
    if (!id.startsWith('eleven_')) continue;
    const name = typeof r.name === 'string' ? r.name.trim() : id;
    out.push({ model_id: id, name });
  }
  return out;
}
