/**
 * Split legacy restructured markdown (meta+dati) e estrazione payload runtime compatto.
 */

const DATA_SECTION_MARKERS = [
  /^##\s+Dati normalizzati\s*$/im,
  /^##\s+Normalized data\s*$/im,
];

/** Separa note meta da tabella dati (formato legacy monolitico). */
export function splitLegacyRestructuredMarkdown(full: string): {
  dataMarkdown: string;
  notesMarkdown: string;
} {
  const text = String(full ?? '').trim();
  if (!text) return { dataMarkdown: '', notesMarkdown: '' };

  for (const marker of DATA_SECTION_MARKERS) {
    const match = marker.exec(text);
    if (match && typeof match.index === 'number') {
      const notesMarkdown = text.slice(0, match.index).trim();
      const dataMarkdown = text.slice(match.index).trim();
      return { dataMarkdown, notesMarkdown };
    }
  }

  if (/^\|/.test(text) || DATA_SECTION_MARKERS.some((m) => m.test(text))) {
    return { dataMarkdown: text, notesMarkdown: '' };
  }

  return { dataMarkdown: '', notesMarkdown: text };
}

/** Rimuove righe vuote eccessive; mantiene tabella markdown compatta per runtime. */
export function compactRestructuredDataMarkdown(dataMarkdown: string): string {
  const lines = String(dataMarkdown ?? '').split(/\r?\n/);
  const out: string[] = [];
  let blankRun = 0;
  for (const line of lines) {
    if (!line.trim()) {
      blankRun += 1;
      if (blankRun <= 1) out.push('');
      continue;
    }
    blankRun = 0;
    out.push(line);
  }
  return out.join('\n').trim();
}

/**
 * Payload dati per runtime agente: solo blocco dati, senza note meta.
 * Gestisce documenti legacy monolitici.
 */
export function extractRestructuredDataForRuntime(storedMarkdown: string): string {
  const raw = String(storedMarkdown ?? '').trim();
  if (!raw) return '';

  const { dataMarkdown, notesMarkdown } = splitLegacyRestructuredMarkdown(raw);
  const data = dataMarkdown.trim() || (notesMarkdown ? '' : raw);
  return compactRestructuredDataMarkdown(data);
}

/** True se il markdown sembra ancora formato legacy (meta + dati insieme). */
export function isLegacyCombinedRestructureMarkdown(markdown: string): boolean {
  const t = String(markdown ?? '');
  return (
    /^##\s+Origine del documento/im.test(t) &&
    DATA_SECTION_MARKERS.some((m) => m.test(t))
  );
}
