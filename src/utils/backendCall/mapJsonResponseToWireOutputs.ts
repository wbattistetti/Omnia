/**
 * Estrae valori dalla risposta JSON usando i path RECEIVE (`apiField`, es. `data.slots`).
 */

export function getJsonAtPath(root: unknown, path: string): unknown {
  const parts = path.split('.').map((p) => p.trim()).filter(Boolean);
  let cur: unknown = root;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export type BackendOutputDef = {
  internalName: string;
  apiField?: string;
};

/**
 * Mappa la risposta JSON negli `internalName` della mock row (`outputs`).
 */
export function mapJsonResponseToWireOutputs(
  responseJson: unknown,
  outputDefs: BackendOutputDef[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const def of outputDefs) {
    const wire = def.internalName?.trim();
    if (!wire) continue;
    const apiPath = (def.apiField || '').trim();
    if (!apiPath) continue;
    const v = getJsonAtPath(responseJson, apiPath);
    if (v !== undefined) {
      out[wire] = v;
    }
  }
  return out;
}
