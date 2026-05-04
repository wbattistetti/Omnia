import { describe, expect, it } from 'vitest';
import {
  ADVANCEMENT_BARE_ARROW_SYNTAX_MESSAGE,
  AdvancementJsExprError,
  evaluateAdvancementJsExpression,
  rejectAdvancementAssignmentSyntax,
  rejectBareRootArrowFunctionSyntax,
  validateAdvancementJsSyntax,
} from './advancementJsExpr';

describe('advancementJsExpr', () => {
  it('evaluates arithmetic and param', () => {
    const v = evaluateAdvancementJsExpression('param.days + 1', {
      prev: {},
      param: { days: 2 },
    });
    expect(v).toBe(3);
  });

  it('rejects top-level assignment pattern', () => {
    expect(() => rejectAdvancementAssignmentSyntax('x = param.days + 1')).toThrow(AdvancementJsExprError);
    expect(() => rejectAdvancementAssignmentSyntax('x = param.days + 1')).toThrow(/Non usare =/);
  });

  it('rejects invalid syntax', () => {
    expect(() => validateAdvancementJsSyntax('param.days +')).toThrow(/Sintassi non ammessa/);
  });

  it('allows comparison == inside expression', () => {
    const v = evaluateAdvancementJsExpression('param.a === prev.b ? 1 : 0', {
      prev: { b: 2 },
      param: { a: 2 },
    });
    expect(v).toBe(1);
  });

  it('rejects bare root arrow function at parse time', () => {
    expect(() => rejectBareRootArrowFunctionSyntax('() => 1')).toThrow(AdvancementJsExprError);
    expect(() => rejectBareRootArrowFunctionSyntax('() => 1')).toThrow(ADVANCEMENT_BARE_ARROW_SYNTAX_MESSAGE);
    expect(() => validateAdvancementJsSyntax('() => { return 1; }')).toThrow(ADVANCEMENT_BARE_ARROW_SYNTAX_MESSAGE);
  });

  it('allows invoked IIFE arrow', () => {
    const v = evaluateAdvancementJsExpression('(() => param.days + 1)()', {
      prev: {},
      param: { days: 2 },
    });
    expect(v).toBe(3);
  });

  it('rejects expression that evaluates to a function (e.g. uninvoked function expr)', () => {
    expect(() =>
      evaluateAdvancementJsExpression('function () { return 1; }', { prev: {}, param: {} })
    ).toThrow(ADVANCEMENT_BARE_ARROW_SYNTAX_MESSAGE);
  });
});
