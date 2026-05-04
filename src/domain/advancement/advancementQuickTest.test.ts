import { describe, expect, it } from 'vitest';
import {
  buildAdvancementContextChips,
  buildParamRecordFromSendMapping,
  formatAdvancementTestResultDisplay,
  paramFieldKeyFromWireKey,
  runAdvancementPlayEvaluation,
  sendRowValueFingerprint,
} from './advancementQuickTest';

describe('advancementQuickTest', () => {
  it('paramFieldKeyFromWireKey uses last segment', () => {
    expect(paramFieldKeyFromWireKey('days')).toBe('days');
    expect(paramFieldKeyFromWireKey('a.b.c')).toBe('c');
  });

  it('sendRowValueFingerprint changes when literal changes', () => {
    const a = sendRowValueFingerprint({
      wireKey: 'k',
      literalConstant: '1',
      variableRefId: undefined,
    });
    const b = sendRowValueFingerprint({
      wireKey: 'k',
      literalConstant: '2',
      variableRefId: undefined,
    });
    expect(a).not.toBe(b);
  });

  it('buildParamRecordFromSendMapping merges literals and applies focus row', () => {
    const { param, error } = buildParamRecordFromSendMapping(
      [
        { wireKey: 'days', literalConstant: '7' },
        { wireKey: 'startDate', literalConstant: '2026-05-01' },
      ],
      { days: 'Int', startDate: 'Date' },
      'startDate',
      { wireKey: 'startDate', literalConstant: '2026-05-01' }
    );
    expect(error).toBeNull();
    expect(param.days).toBe(7);
    expect(param.startDate).toBe('2026-05-01');
  });

  it('buildAdvancementContextChips legacy lists prev, param, result when no focus', () => {
    const chips = buildAdvancementContextChips(
      {
        prev: { startDate: '2026-05-01' },
        param: { days: 7 },
      },
      '2026-05-08'
    );
    expect(chips.map((c) => c.label)).toContain('prev · startDate');
    expect(chips.map((c) => c.label)).toContain('param · days');
    expect(chips.find((c) => c.key === '__result')?.value).toBe('2026-05-08');
  });

  it('buildAdvancementContextChips focus mode shows Precedente and Nuovo only', () => {
    const chips = buildAdvancementContextChips(
      {
        prev: { start_date: '2026-05-04', days: 30 },
        param: { start_date: '2026-05-04', days: 30 },
      },
      '2026-06-04',
      { focusWireKey: 'start_date' }
    );
    expect(chips).toHaveLength(2);
    expect(chips[0].label).toBe('Precedente');
    expect(chips[0].tone).toBe('precedente');
    expect(chips[0].value).toBe('2026-05-04');
    expect(chips[1].label).toBe('Nuovo');
    expect(chips[1].tone).toBe('nuovo');
    expect(chips[1].value).toBe('2026-06-04');
  });

  it('runAdvancementPlayEvaluation matches typed result', () => {
    const out = runAdvancementPlayEvaluation(
      '1 + 2',
      { prev: {}, param: {} },
      'Int'
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.display).toBe('3');
  });

  it('formatAdvancementTestResultDisplay uses plain text for numbers and strings', () => {
    expect(formatAdvancementTestResultDisplay(42)).toBe('42');
    expect(formatAdvancementTestResultDisplay('x')).toBe('x');
    expect(formatAdvancementTestResultDisplay('2026-05-04')).toBe('2026-05-04');
  });
});
