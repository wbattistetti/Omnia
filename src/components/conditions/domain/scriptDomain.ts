// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Normalizes code text by removing carriage returns and trimming.
 */
export function normalizeCode(txt: string): string {
  try {
    return String(txt || '').replace(/\r/g, '').trim();
  } catch {
    return '';
  }
}

/**
 * Parses a simplified template with comments and quoted label.
 * Extracts:
 * - label: first quoted line after the first comment
 * - when: text between the second and third comment blocks
 * - vars: (not currently extracted)
 */
export interface ParsedTemplate {
  label?: string;
  when?: string;
  vars?: string[];
}

export function parseTemplate(txt: string): ParsedTemplate {
  const src = String(txt || '');

  // label: first quoted line after the first comment
  const mLabel = src.match(/^[ \t]*\/\/\s*Puoi cambiare[^\n]*\n[ \t]*"([^"]*)"/m);
  const label = mLabel ? mLabel[1].trim() : undefined;

  // when: text between the second and third comment blocks
  const mWhen = src.match(/\/\/\s*Descrivi[^\n]*\n([\s\S]*?)\n\/\/\s*Indica\s*o\s*descrivi/i);
  const when = mWhen ? mWhen[1].trim() : undefined;

  return { label, when, vars: undefined };
}

/**
 * Synthesizes composite date variables from sub-components.
 * If script uses a composite date like "...Date" but AI suggested Year/Month/Day,
 * synthesizes ISO date string.
 */
export function synthesizeDateVariables(
  varsIn: Record<string, any> | undefined,
  usedVars: string[]
): Record<string, any> | undefined {
  if (!varsIn) return varsIn;

  const out = { ...varsIn };

  usedVars.forEach((k) => {
    if (out[k]) return; // Already has value

    const base = k.endsWith('.Date') ? k.slice(0, -('.Date'.length)) : '';
    if (!base) return;

    const y = out[`${base}.Date.Year`] ?? out[`${base}.Year`];
    const m = out[`${base}.Date.Month`] ?? out[`${base}.Month`];
    const d = out[`${base}.Date.Day`] ?? out[`${base}.Day`];

    if (y != null && m != null && d != null) {
      const mm = String(m).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      out[k] = `${y}-${mm}-${dd}`;
    }
  });

  return out;
}

/**
 * Post-fixes common alias mistakes in generated scripts.
 * Rewrites aliases (e.g., Act.DOB) to the selected Date key when unique.
 */
export function fixDateAliases(
  script: string,
  availableVars: string[]
): string {
  try {
    const all = availableVars || [];
    const dateCandidates = all.filter(k => /date of birth/i.test(k) || /\.Date$/.test(k));

    if (dateCandidates.length === 1) {
      const target = dateCandidates[0].replace(/"/g, '\\"'); // guard
      const patterns = [
        /vars\[\s*(["'`])Act\.?DOB\1\s*\]/gi,
        /vars\[\s*(["'`])DateOfBirth\1\s*\]/gi,
        /vars\[\s*(["'`])DOB\1\s*\]/gi,
        /vars\[\s*(["'`])Act\.?DateOfBirth\1\s*\]/gi
      ];

      let result = script;
      patterns.forEach(re => {
        result = result.replace(re, `vars["${target}"]`);
      });

      return result;
    }
  } catch {}

  return script;
}
