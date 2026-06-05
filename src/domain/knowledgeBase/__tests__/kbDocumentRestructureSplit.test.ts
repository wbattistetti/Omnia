import { describe, expect, it } from 'vitest';
import {
  compactRestructuredDataMarkdown,
  extractRestructuredDataForRuntime,
  isLegacyCombinedRestructureMarkdown,
  splitLegacyRestructuredMarkdown,
} from '../kbDocumentRestructureSplit';

describe('splitLegacyRestructuredMarkdown', () => {
  it('splits meta from data section', () => {
    const full = `## Origine del documento
- tipo MIXED

## Dati normalizzati

| code | label |
| --- | --- |
| 1 | Visita |`;

    const { dataMarkdown, notesMarkdown } = splitLegacyRestructuredMarkdown(full);
    expect(notesMarkdown).toContain('Origine del documento');
    expect(dataMarkdown).toContain('Dati normalizzati');
    expect(dataMarkdown).toContain('| 1 | Visita |');
  });
});

describe('extractRestructuredDataForRuntime', () => {
  it('returns only data block for legacy combined markdown', () => {
    const full = `## Origine
note

## Dati normalizzati
| a | b |
| --- | --- |
| 1 | x |`;

    const out = extractRestructuredDataForRuntime(full);
    expect(out).not.toContain('Origine');
    expect(out).toContain('| 1 | x |');
  });

  it('compacts extra blank lines', () => {
    const out = compactRestructuredDataMarkdown('line1\n\n\n\nline2');
    expect(out).toBe('line1\n\nline2');
  });
});

describe('isLegacyCombinedRestructureMarkdown', () => {
  it('detects legacy format', () => {
    expect(
      isLegacyCombinedRestructureMarkdown('## Origine del documento\n\n## Dati normalizzati\n| a |')
    ).toBe(true);
    expect(isLegacyCombinedRestructureMarkdown('## Dati normalizzati\n| a |')).toBe(false);
  });
});
