/**
 * Recap shown in AI Agent wizard after ElevenLabs flow-canvas drop (stored in `agentIaRuntimeOverrideJson`).
 */

export type ElevenLabsImportRecap = {
  nodeLabel: string;
  remoteAgentId: string;
  remoteAgentName: string;
  promptApplied: boolean;
  variableCount: number;
  backendsAdded: number;
  backendsLinked: number;
  importedAt: string;
};

export type IaRuntimeElevenLabsExtras = {
  elevenLabsWorkflowNodeId?: string;
  elevenLabsImportRecap?: ElevenLabsImportRecap;
};

export function parseElevenLabsImportRecapFromIaJson(
  raw: string | undefined | null
): ElevenLabsImportRecap | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  try {
    const o = JSON.parse(s) as IaRuntimeElevenLabsExtras;
    const r = o?.elevenLabsImportRecap;
    if (!r || typeof r !== 'object') return null;
    if (!String(r.remoteAgentId ?? '').trim()) return null;
    return r;
  } catch {
    return null;
  }
}

export function clearElevenLabsImportRecapInIaJson(raw: string | undefined | null): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  try {
    const o = JSON.parse(s) as IaRuntimeElevenLabsExtras;
    if (!o.elevenLabsImportRecap) return s;
    const { elevenLabsImportRecap: _removed, ...rest } = o;
    return JSON.stringify(rest);
  } catch {
    return s;
  }
}
