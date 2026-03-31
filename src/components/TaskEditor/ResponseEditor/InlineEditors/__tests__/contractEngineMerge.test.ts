import { describe, it, expect } from 'vitest';
import {
  applyRegexPatternToContract,
  applyRulesExtractorCodeToContract,
  applyNerEntityTypesToContract,
} from '../contractEngineMerge';

describe('contractEngineMerge', () => {
  it('applyRegexPatternToContract creates regex engine when missing', () => {
    const next = applyRegexPatternToContract(null, '\\d+');
    expect(next.engines?.length).toBe(1);
    expect((next.engines![0] as any).type).toBe('regex');
    expect((next.engines![0] as any).patterns).toEqual(['\\d+']);
  });

  it('applyRegexPatternToContract updates existing regex engine', () => {
    const base = {
      engines: [{ type: 'regex', enabled: true, patterns: ['a'], examples: [] }],
    };
    const next = applyRegexPatternToContract(base as any, 'b');
    expect((next.engines![0] as any).patterns).toEqual(['b']);
  });

  it('applyRulesExtractorCodeToContract upserts rules engine', () => {
    const next = applyRulesExtractorCodeToContract(null, 'export const x = 1;');
    const rules = next.engines?.find((e: any) => e.type === 'rules');
    expect(rules?.extractorCode).toBe('export const x = 1;');
  });

  it('applyNerEntityTypesToContract upserts ner engine', () => {
    const next = applyNerEntityTypesToContract(null, ['PER', 'LOC']);
    const ner = next.engines?.find((e: any) => e.type === 'ner');
    expect(ner?.entityTypes).toEqual(['PER', 'LOC']);
  });
});
