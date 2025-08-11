import { describe, it, expect } from 'vitest';
import { nextNoInput, nextNoMatch, nextConfirmNoInput, nextConfirmNoMatch, nextNotConfirmed } from '../escalation';

describe('escalation helpers', () => {
  it('progressive caps at 3', () => {
    let c = 0;
    c = nextNoInput(c); // 1
    c = nextNoInput(c); // 2
    c = nextNoInput(c); // 3
    c = nextNoInput(c); // stays 3
    expect(c).toBe(3);
  });

  it('rotate cycles 1..3', () => {
    let c = 0;
    c = nextNoMatch(c, 'rotate'); // 1
    c = nextNoMatch(c, 'rotate'); // 2
    c = nextNoMatch(c, 'rotate'); // 3
    c = nextNoMatch(c, 'rotate'); // 1
    expect(c).toBe(1);
  });

  it('works for confirm counters and notConfirmed', () => {
    expect(nextConfirmNoInput(0)).toBe(1);
    expect(nextConfirmNoMatch(2)).toBe(3);
    expect(nextNotConfirmed(3)).toBe(3);
  });
});


