/**
 * Canonical token syntax for backend placeholder instances embedded in section text.
 * Format: {{omniabp:<uuid>}} — resolver maps uuid → definition via {@link BackendPlaceholderInstance}.
 */

import type { BackendPlaceholderInstance } from './types';

/** Matches `{{omniabp:<id>}}` where id is a non-empty token (typically UUID). */
export const OMNIABP_TOKEN_REGEX = /\{\{omniabp:([^}]+)\}\}/g;

export function makeOmniabpToken(instanceId: string): string {
  const id = instanceId.trim();
  if (!id) {
    throw new Error('makeOmniabpToken: instance id is required');
  }
  return `{{omniabp:${id}}}`;
}

/** Lists unique omniabp instance ids appearing in text (order of first appearance). */
export function extractOmniabpInstanceIds(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const re = new RegExp(OMNIABP_TOKEN_REGEX.source, 'g');
  let m: RegExpExecArray | null;
  const s = String(text ?? '');
  while ((m = re.exec(s)) !== null) {
    const id = m[1].trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Validates that every token in text has a matching row in instances (by id). */
export function validatePlaceholderInstancesAgainstText(
  fullText: string,
  instances: readonly BackendPlaceholderInstance[]
): { ok: true } | { ok: false; missingInText: string[]; orphanInstances: string[] } {
  const idsInText = new Set(extractOmniabpInstanceIds(fullText));
  const idSet = new Set(instances.map((i) => i.id));
  const missingInText: string[] = [];
  for (const id of idSet) {
    if (!idsInText.has(id)) missingInText.push(id);
  }
  const orphanInstances: string[] = [];
  for (const id of idsInText) {
    if (!idSet.has(id)) orphanInstances.push(id);
  }
  if (missingInText.length > 0 || orphanInstances.length > 0) {
    return { ok: false, missingInText, orphanInstances };
  }
  return { ok: true };
}
