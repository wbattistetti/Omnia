import { describe, it, expect } from 'vitest';
import {
  messageHasSlotBrackets,
  stripAgentMessageSlotBrackets,
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
