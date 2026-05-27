/**
 * Conversione liste markdown ↔ array per sezioni analisi backend.
 */

/** Estrae righe bullet (- o *) da markdown. */
export function parseMarkdownBulletList(markdown: string): string[] {
  const lines = String(markdown ?? '').split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*[-*]\s+(.+)$/);
    if (m?.[1]) out.push(m[1].trim());
  }
  return out;
}

/** Lista puntata markdown da stringhe. */
export function bulletsToMarkdown(bullets: readonly string[]): string {
  const items = bullets.map((b) => b.trim()).filter(Boolean);
  if (items.length === 0) return '';
  return items.map((b) => `- ${b}`).join('\n');
}

/** Backend mancanti: `- nome — motivo` o solo nome. */
export function missingBackendsToMarkdown(
  entries: readonly { name: string; reason: string }[]
): string {
  if (!entries.length) return '';
  return entries
    .map((m) => {
      const name = m.name.trim();
      const reason = m.reason.trim();
      return reason ? `- ${name} — ${reason}` : `- ${name}`;
    })
    .join('\n');
}

export function parseMissingBackendsMarkdown(markdown: string): Array<{ name: string; reason: string }> {
  const out: Array<{ name: string; reason: string }> = [];
  for (const line of parseMarkdownBulletList(markdown)) {
    const sep = line.indexOf('—');
    if (sep >= 0) {
      out.push({
        name: line.slice(0, sep).trim(),
        reason: line.slice(sep + 1).trim(),
      });
    } else {
      const alt = line.indexOf(' - ');
      if (alt >= 0) {
        out.push({ name: line.slice(0, alt).trim(), reason: line.slice(alt + 3).trim() });
      } else {
        out.push({ name: line, reason: '' });
      }
    }
  }
  return out;
}

/** Allinea campi markdown legacy da array strutturati. */
export function ensureGlobalSectionMarkdown(
  global: {
    generalRules: string[];
    missingBackends: Array<{ name: string; reason: string }>;
    generalRulesMarkdown?: string;
    missingBackendsMarkdown?: string;
    whyMissingMarkdown?: string;
  }
): {
  generalRulesMarkdown: string;
  missingBackendsMarkdown: string;
  whyMissingMarkdown: string;
} {
  const generalRulesMarkdown =
    String(global.generalRulesMarkdown ?? '').trim() ||
    bulletsToMarkdown(global.generalRules);
  const missingBackendsMarkdown =
    String(global.missingBackendsMarkdown ?? '').trim() ||
    missingBackendsToMarkdown(global.missingBackends);
  const whyMissingMarkdown =
    String(global.whyMissingMarkdown ?? '').trim() ||
    global.missingBackends
      .map((m) => m.reason.trim())
      .filter(Boolean)
      .map((r) => `- ${r}`)
      .join('\n');
  return { generalRulesMarkdown, missingBackendsMarkdown, whyMissingMarkdown };
}
