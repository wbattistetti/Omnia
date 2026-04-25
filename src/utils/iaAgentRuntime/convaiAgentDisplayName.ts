/**
 * Costruisce il `name` ElevenLabs ConvAI: parte leggibile slug + `__GUID_{taskGuid}` (sempre integro in coda).
 * Limite interno conservativo sul totale per ridurre 422 da limiti API non documentati.
 */

const MAX_NAME_LEN = 120;
const GUID_SUFFIX_PREFIX = '__GUID_';

function slugSegment(raw: string, maxLen: number): string {
  const t = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!t) return 'x';
  return t.length <= maxLen ? t : t.slice(0, maxLen);
}

/**
 * @param taskGuid UUID task Omnia (stabile)
 */
export function buildConvaiAgentDisplayName(params: {
  projectLabel: string;
  flowLabel: string;
  nodeLabel: string;
  taskGuid: string;
}): string {
  const guid = String(params.taskGuid || '').trim();
  if (!guid) throw new Error('buildConvaiAgentDisplayName: taskGuid mancante');

  const suffix = `${GUID_SUFFIX_PREFIX}${guid}`;
  const budget = Math.max(8, MAX_NAME_LEN - suffix.length);
  const third = Math.max(2, Math.floor(budget / 3));
  const p = slugSegment(params.projectLabel, third);
  const f = slugSegment(params.flowLabel, third);
  const n = slugSegment(params.nodeLabel, Math.max(2, budget - p.length - f.length - 2));
  const human = [p, f, n].filter(Boolean).join('-');
  const full = `${human}${suffix}`;
  if (full.length <= MAX_NAME_LEN) return full;
  /* Estremo: solo GUID suffix se human troppo lungo */
  return `${slugSegment(human, 8)}${suffix}`.slice(0, MAX_NAME_LEN);
}

export function convaiGuidMarker(taskGuid: string): string {
  return `${GUID_SUFFIX_PREFIX}${String(taskGuid || '').trim()}`;
}

export function agentNameContainsTaskGuid(agentName: string | undefined | null, taskGuid: string): boolean {
  const n = String(agentName ?? '');
  const g = String(taskGuid || '').trim();
  if (!g) return false;
  return n.includes(convaiGuidMarker(g));
}
