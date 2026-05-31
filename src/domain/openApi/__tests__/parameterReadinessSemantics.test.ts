import { describe, expect, it } from 'vitest';
import {
  buildParameterGaps,
  classifyParameterAuditProfile,
  isPassiveReceiveCounterPath,
} from '../parameterReadinessSemantics';

const emptyPresent = {
  type: true,
  format: false,
  enum: false,
  minMax: false,
  pattern: false,
  description: false,
  xAgentInstructions: false,
  xOpenaiIsConsequential: false,
};

describe('parameterReadinessSemantics', () => {
  it('classifica summary.totalSlots come receive-passive', () => {
    expect(
      classifyParameterAuditProfile({
        path: 'summary.totalSlots',
        direction: 'receive',
        inConvaiTool: false,
        type: 'integer',
        present: emptyPresent,
      })
    ).toBe('receive-passive');
  });

  it('classifica slots[].date come receive-interactive', () => {
    expect(
      classifyParameterAuditProfile({
        path: 'slots[].date',
        direction: 'receive',
        inConvaiTool: false,
        type: 'string',
        present: { ...emptyPresent, format: true },
        format: 'date',
      })
    ).toBe('receive-interactive');
  });

  it('SEND è sempre send-input', () => {
    expect(
      classifyParameterAuditProfile({
        path: 'windowDays',
        direction: 'send',
        inConvaiTool: true,
        type: 'integer',
        present: emptyPresent,
      })
    ).toBe('send-input');
  });

  it('receive-passive non genera gap', () => {
    const r = buildParameterGaps({
      path: 'summary.freeSlots',
      direction: 'receive',
      inConvaiTool: false,
      type: 'integer',
      present: emptyPresent,
    });
    expect(r.profile).toBe('receive-passive');
    expect(r.gaps).toEqual([]);
    expect(r.severity).toBe('ok');
  });

  it('SEND string senza dominio → BLOCKER', () => {
    const r = buildParameterGaps({
      path: 'horizon',
      direction: 'send',
      inConvaiTool: true,
      type: 'string',
      present: emptyPresent,
    });
    expect(r.severity).toBe('blocker');
    expect(r.gaps.some((g) => g.includes('string SEND senza'))).toBe(true);
  });

  it('SEND integer senza bound → gap con messaggio NL contestualizzato', () => {
    const r = buildParameterGaps({
      path: 'windowDays',
      direction: 'send',
      inConvaiTool: true,
      type: 'integer',
      present: emptyPresent,
    });
    expect(r.gaps.some((g) => g.includes('prossimi 5 giorni'))).toBe(true);
  });

  it('isPassiveReceiveCounterPath riconosce freeSlots', () => {
    expect(isPassiveReceiveCounterPath('summary.freeSlots', 'integer')).toBe(true);
    expect(isPassiveReceiveCounterPath('preferredTimeIntervals', 'string')).toBe(false);
  });
});
