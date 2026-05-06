/**
 * Costruisce il `name` ElevenLabs ConvAI: prefisso deterministico OMNIA + segmenti (cliente, progetto, versione, flow, nodo)
 * + `__GUID_{taskGuid}` in coda per list/delete ElevenLabs (`search` sul marker).
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

function trimHumanPrefixForSuffix(human: string, suffix: string, maxTotal: number): string {
  const s = String(suffix || '');
  if (human.length + s.length <= maxTotal) return human;
  const budget = Math.max(4, maxTotal - s.length);
  return human.length <= budget ? human : human.slice(0, budget);
}

/**
 * @param taskGuid UUID task Omnia (stabile)
 * @param omniaClientLabel — es. `ProjectData.clientName` / `ownerClient` (default `default`)
 * @param omniaVersionLabel — es. `ProjectData.version` (default `0`)
 */
export function buildConvaiAgentDisplayName(params: {
  projectLabel: string;
  flowLabel: string;
  nodeLabel: string;
  taskGuid: string;
  omniaClientLabel?: string;
  omniaVersionLabel?: string;
}): string {
  const guid = String(params.taskGuid || '').trim();
  if (!guid) throw new Error('buildConvaiAgentDisplayName: taskGuid mancante');

  const suffix = `${GUID_SUFFIX_PREFIX}${guid}`;
  const client = slugSegment(params.omniaClientLabel ?? 'default', 20);
  const ver = slugSegment(params.omniaVersionLabel ?? '0', 12);
  const proj = slugSegment(params.projectLabel, 24);
  const flow = slugSegment(params.flowLabel, 16);
  const node = slugSegment(params.nodeLabel, 16);

  const humanCore = `OMNIA_${client}_${proj}_${ver}_${flow}_${node}`;
  const full = trimHumanPrefixForSuffix(humanCore, suffix, MAX_NAME_LEN) + suffix;
  if (full.length <= MAX_NAME_LEN) return full;
  return (trimHumanPrefixForSuffix('OMNIA', suffix, MAX_NAME_LEN) + suffix).slice(0, MAX_NAME_LEN);
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
