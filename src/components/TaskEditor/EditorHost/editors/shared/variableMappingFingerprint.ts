/**
 * Stable string fingerprint for Map<guid, label> so hooks can detect mapping changes
 * without depending on Map reference identity.
 */
export function fingerprintVariableMapping(map: Map<string, string>): string {
  if (!map.size) return '';
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}\u001f${v}`)
    .join('\u0001');
}
