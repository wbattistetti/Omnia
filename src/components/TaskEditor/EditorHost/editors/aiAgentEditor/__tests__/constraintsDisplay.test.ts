import { describe, expect, it } from 'vitest';
import { formatConstraintsBullets } from '../constraintsDisplay';

describe('formatConstraintsBullets', () => {
  it('formats Must and Must not blocks with bullets', () => {
    const raw =
      'Must: Always confirm date. Never skip validation.\n\nMust not: Invent slots. Share secrets.';
    const out = formatConstraintsBullets(raw);
    expect(out).toContain('Must:');
    expect(out).toContain('Must not:');
    expect(out).toMatch(/- Always confirm date/);
    expect(out).toMatch(/- Invent slots/);
  });

  it('splits long single-line obligations into bullets', () => {
    const raw = 'Must: Rule one here. Rule two follows. Rule three ends.';
    const out = formatConstraintsBullets(raw);
    expect(out.split('\n').filter((l) => l.startsWith('- ')).length).toBeGreaterThanOrEqual(2);
  });
});
