import { describe, expect, it } from 'vitest';
import {
  bulletsToMarkdown,
  ensureGlobalSectionMarkdown,
  parseMarkdownBulletList,
  parseMissingBackendsMarkdown,
} from '../backendAnalysisSectionMarkdown';

describe('backendAnalysisSectionMarkdown', () => {
  it('round-trips bullet lists', () => {
    const md = '- regola A\n- regola B';
    expect(parseMarkdownBulletList(md)).toEqual(['regola A', 'regola B']);
    expect(bulletsToMarkdown(['regola A', 'regola B'])).toBe(md);
  });

  it('parses missing backends with reason', () => {
    const md = '- bookfromagenda — non nel catalogo';
    expect(parseMissingBackendsMarkdown(md)).toEqual([
      { name: 'bookfromagenda', reason: 'non nel catalogo' },
    ]);
  });

  it('ensureGlobalSectionMarkdown derives whyMissing from missingBackends reasons', () => {
    const result = ensureGlobalSectionMarkdown({
      generalRules: ['regola A'],
      missingBackends: [{ name: 'x', reason: 'manca nel flow' }],
    });
    expect(result.generalRulesMarkdown).toBe('- regola A');
    expect(result.whyMissingMarkdown).toBe('- manca nel flow');
  });
});

// ensureGlobalSectionMarkdown kept for legacy import path in ux normalize
