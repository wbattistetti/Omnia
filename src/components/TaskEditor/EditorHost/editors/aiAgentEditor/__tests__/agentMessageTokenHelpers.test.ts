import { describe, it, expect } from 'vitest';
import {
  computeAgentTokenSelectionPopoverAction,
  messageHasSlotBrackets,
  stripAgentMessageSlotBrackets,
  unwrapBracketTokenContainingSelection,
  buildBracketWrapForSelection,
} from '../agentMessageTokenHelpers';

describe('stripAgentMessageSlotBrackets', () => {
  it('removes brackets preserving inner text', () => {
    expect(stripAgentMessageSlotBrackets('ciao [nome]!')).toBe('ciao nome!');
  });

  it('handles multiple slots', () => {
    expect(stripAgentMessageSlotBrackets('[a] e [b]')).toBe('a e b');
  });
});

describe('messageHasSlotBrackets', () => {
  it('detects brackets', () => {
    expect(messageHasSlotBrackets('foo [x]')).toBe(true);
    expect(messageHasSlotBrackets('no brackets')).toBe(false);
  });
});

describe('computeAgentTokenSelectionPopoverAction', () => {
  it('returns none for empty or collapsed selection', () => {
    expect(computeAgentTokenSelectionPopoverAction('hello', 0, 0)).toBe('none');
    expect(computeAgentTokenSelectionPopoverAction('hello', 2, 2)).toBe('none');
  });

  it('returns tokenize for non-empty plain selection', () => {
    expect(computeAgentTokenSelectionPopoverAction('hello', 1, 3)).toBe('tokenize');
  });

  it('returns untokenize when selection is inside one bracket token', () => {
    const t = 'Altre [25 aprile] qui';
    const open = t.indexOf('[');
    const inner = t.indexOf('25');
    expect(computeAgentTokenSelectionPopoverAction(t, open, open + '[25 aprile]'.length)).toBe(
      'untokenize'
    );
    expect(computeAgentTokenSelectionPopoverAction(t, inner, inner + 2)).toBe('untokenize');
  });

  it('returns tokenize for plain text selection', () => {
    expect(computeAgentTokenSelectionPopoverAction('foo bar', 4, 7)).toBe('tokenize');
  });
});

describe('buildBracketWrapForSelection', () => {
  it('trims leading and trailing spaces inside the selection and wraps the core', () => {
    const content = 'Per iniziare la visita';
    const start = content.indexOf(' ');
    const end = content.indexOf(' la');
    const r = buildBracketWrapForSelection(content, start, end);
    expect(r).not.toBeNull();
    expect(r!.next).toBe('Per [iniziare] la visita');
    expect(r!.selStart).toBe(r!.next.indexOf('['));
    expect(r!.selEnd).toBe(r!.selStart + '[iniziare]'.length);
  });

  it('returns null when selection trims to empty', () => {
    expect(buildBracketWrapForSelection('hello   ', 5, 8)).toBeNull();
  });
});

describe('unwrapBracketTokenContainingSelection', () => {
  it('removes brackets for the token containing the selection', () => {
    const t = 'x [25 aprile] y';
    const inner = t.indexOf('25');
    const r = unwrapBracketTokenContainingSelection(t, inner, inner + 2);
    expect(r).not.toBeNull();
    expect(r!.next).toBe('x 25 aprile y');
    expect(r!.selStart).toBe(2);
    expect(r!.selEnd).toBe(11);
  });

  it('returns null when selection is not inside a token', () => {
    expect(unwrapBracketTokenContainingSelection('a b [c]', 0, 1)).toBeNull();
  });
});
