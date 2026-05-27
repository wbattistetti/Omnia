/**
 * Suddivisione analisi documento KB per sezione ### (revisione Monaco per blocco).
 */

export type KbAnalysisSectionId = `kbSection:${string}`;

export type KbAnalysisSectionSlice = {
  id: KbAnalysisSectionId;
  heading: string;
  body: string;
};

export type ParsedKbAnalysisDocument = {
  preamble: string;
  sections: KbAnalysisSectionSlice[];
};

function slugFromHeading(heading: string): string {
  const s = heading
    .replace(/^#+\s*/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return s || 'section';
}

/** Id stabile per intestazione ###. */
export function kbAnalysisSectionIdFromHeading(heading: string): KbAnalysisSectionId {
  return `kbSection:${slugFromHeading(heading)}`;
}

/** Spezza markdown in preamble (## Type…) e sezioni ###. */
export function parseKbAnalysisSections(markdown: string): ParsedKbAnalysisDocument {
  const lines = markdown.split(/\r?\n/);
  const preambleLines: string[] = [];
  const sections: KbAnalysisSectionSlice[] = [];
  let currentHeading = '';
  let currentBody: string[] = [];
  let inSection = false;

  const flush = () => {
    if (!inSection || !currentHeading) return;
    sections.push({
      id: kbAnalysisSectionIdFromHeading(currentHeading),
      heading: currentHeading,
      body: currentBody.join('\n').trim(),
    });
    currentBody = [];
  };

  for (const line of lines) {
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      flush();
      inSection = true;
      currentHeading = h3[1]!.trim();
      continue;
    }
    if (inSection) {
      currentBody.push(line);
    } else {
      preambleLines.push(line);
    }
  }
  flush();

  return {
    preamble: preambleLines.join('\n').trim(),
    sections,
  };
}

/** Ricompone markdown completo. */
export function composeKbAnalysisMarkdown(parsed: ParsedKbAnalysisDocument): string {
  const parts: string[] = [];
  if (parsed.preamble.trim()) parts.push(parsed.preamble.trim());
  for (const s of parsed.sections) {
    parts.push(`### ${s.heading}`, '', s.body, '');
  }
  return parts.join('\n').trimEnd() + '\n';
}

/** Baseline per sezione da markdown completo. */
export function buildKbSectionBaselinesFromMarkdown(
  markdown: string
): Record<string, string> {
  const parsed = parseKbAnalysisSections(markdown);
  const out: Record<string, string> = {};
  for (const s of parsed.sections) {
    out[s.id] = s.body;
  }
  return out;
}

/** Applica patch corpo sezione e ricompone documento. */
export function patchKbAnalysisSectionBody(
  fullMarkdown: string,
  sectionId: KbAnalysisSectionId,
  nextBody: string
): string {
  const parsed = parseKbAnalysisSections(fullMarkdown);
  const sections = parsed.sections.map((s) =>
    s.id === sectionId ? { ...s, body: nextBody } : s
  );
  return composeKbAnalysisMarkdown({ ...parsed, sections });
}

export function kbSectionReviewHeading(heading: string): string {
  return `### ${heading}`;
}
