import { Assertion } from '../models/types';
import { getByPath } from './jsonPath';

export function evaluateAssertions(output: unknown, assertions: Assertion[]): { ok: boolean; error?: string } {
  try {
    for (const a of assertions) {
      if (a.kind === 'equals') {
        if (JSON.stringify(output) !== JSON.stringify(a.expected)) return { ok: false, error: `Not equal` };
      } else if (a.kind === 'approx') {
        if (typeof output !== 'number') return { ok: false, error: 'Not a number' };
        if (Math.abs(output - a.expected) > a.tol) return { ok: false, error: 'Out of tolerance' };
      } else if (a.kind === 'matches') {
        const re = new RegExp(a.regex);
        if (typeof output !== 'string' || !re.test(output)) return { ok: false, error: 'Regex mismatch' };
      } else if (a.kind === 'jsonPathEquals') {
        const v = getByPath(output as any, a.path);
        if (JSON.stringify(v) !== JSON.stringify(a.expected)) return { ok: false, error: `jsonPath mismatch at ${a.path}` };
      } else if (a.kind === 'oneOf') {
        if (!a.options.some(o => JSON.stringify(o) === JSON.stringify(output))) return { ok: false, error: 'Not in options' };
      }
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}




