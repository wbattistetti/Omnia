/**
 * Parse summary string (e.g., "day=12, month=3, year=1980") into key-value pairs
 */
export function parseSummaryToGroups(summary: string | undefined): Record<string, string | undefined> {
  const kv: Record<string, string | undefined> = {};
  const text = (summary || '—').toString();
  if (text !== '—') {
    text.split(',').forEach(part => {
      const sp = part.split('=');
      const k = sp[0] && sp[0].trim();
      const v = typeof sp[1] !== 'undefined' ? String(sp[1]).trim() : undefined;
      if (k) kv[k] = v;
    });
  }
  return kv;
}
