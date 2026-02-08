// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

type VarsMap = Record<string, any>;
type VarsTreeSub = { label: string; kind?: string };
type VarsTreeMain = { label: string; kind?: string; subs: VarsTreeSub[] };
export type VarsTreeAct = { label: string; color?: string; Icon?: any; mains: VarsTreeMain[] };

/**
 * Lists all variable keys from a variables map, sorted alphabetically.
 */
export function listKeys(vars: VarsMap): string[] {
  try {
    return Object.keys(vars || {}).sort();
  } catch {
    return [];
  }
}

/**
 * Flattens a hierarchical variables tree into a flat array of variable keys.
 * Format: "ActLabel.MainLabel" or "ActLabel.MainLabel.SubLabel"
 */
export function flattenVariablesTree(tree: VarsTreeAct[]): string[] {
  if (!tree || tree.length === 0) return [];

  const out: string[] = [];
  tree.forEach(act => {
    (act.mains || []).forEach(m => {
      out.push(`${act.label}.${m.label}`);
      (m.subs || []).forEach(s => {
        out.push(`${act.label}.${m.label}.${s.label}`);
      });
    });
  });
  return out;
}

/**
 * Filters a variables tree based on a search query.
 * Matches act labels, main labels, and sub labels.
 */
export function filterVariablesTree(
  tree: VarsTreeAct[],
  query: string
): VarsTreeAct[] {
  const q = (query || '').trim().toLowerCase();
  if (!q) return tree || [];

  const match = (label?: string) => String(label || '').toLowerCase().includes(q);
  const res: VarsTreeAct[] = [];

  (tree || []).forEach(act => {
    const mains: VarsTreeMain[] = [];
    (act.mains || []).forEach(m => {
      const subs: VarsTreeSub[] = [];
      (m.subs || []).forEach(s => {
        if (match(`${act.label}.${m.label}.${s.label}`) || match(s.label)) {
          subs.push(s);
        }
      });
      if (subs.length || match(`${act.label}.${m.label}`) || match(m.label)) {
        mains.push({ ...m, subs });
      }
    });
    if (mains.length || match(act.label)) {
      res.push({ ...act, mains });
    }
  });

  return res;
}

/**
 * Finds groups of variables with duplicate trailing labels.
 * Returns groups where multiple variables share the same tail (last 2 segments).
 */
export function findDuplicateGroups(
  variables: string[]
): Array<{ tail: string; options: string[] }> {
  const map: Record<string, string[]> = {};

  variables.forEach(full => {
    const tail = full.split('.').slice(-2).join('.') || full;
    map[tail] = map[tail] ? [...map[tail], full] : [full];
  });

  const dups: Array<{ tail: string; options: string[] }> = [];
  Object.keys(map).forEach(tail => {
    if ((map[tail] || []).length > 1) {
      dups.push({ tail, options: map[tail] });
    }
  });

  return dups;
}

/**
 * Extracts variable keys actually used in a script.
 * Supports multiple patterns:
 * - CONDITION.inputs: [...] (priority)
 * - getVar(ctx, "...")
 * - ctx["..."]
 * - const k = "..."; ctx[k] (1-step constant propagation)
 * - vars["..."] (legacy)
 */
export function extractUsedVariables(script: string): string[] {
  try {
    const source = String(script || '');

    // 1) CONDITION.inputs (priority — if present, return ONLY these)
    const inputs: string[] = [];
    try {
      const inputsBlockMatch = source.match(/CONDITION[\s\S]*?inputs\s*:\s*\[([\s\S]*?)\]/m);
      if (inputsBlockMatch) {
        const block = inputsBlockMatch[1] || '';
        const singleQuoted = Array.from(block.matchAll(/'([^']+)'/g)).map(m => m[1]);
        const doubleQuoted = Array.from(block.matchAll(/"([^"]+)"/g)).map(m => m[1]);
        const backticked = Array.from(block.matchAll(/`([^`]+)`/g)).map(m => m[1]);
        const ordered: string[] = [];
        const once = new Set<string>();
        [...singleQuoted, ...doubleQuoted, ...backticked].forEach(k => {
          if (!once.has(k)) {
            once.add(k);
            ordered.push(k);
          }
        });
        inputs.push(...ordered);
      }
    } catch {}

    // If CONDITION.inputs found, return only those
    if (inputs.length > 0) return inputs;

    // 2) Other reads — union of explicit patterns
    const reads = new Set<string>();

    // 2a) getVar(ctx, "...")
    try {
      const re = /getVar\s*\(\s*ctx\s*,\s*(["'`])([^"'`]+)\1\s*\)/g;
      let mm: RegExpExecArray | null;
      while ((mm = re.exec(source)) !== null) {
        reads.add(mm[2]);
      }
    } catch {}

    // 2b) ctx["..."] direct
    try {
      const re = /ctx\s*\[\s*(["'`])([^"'`]+)\1\s*\]/g;
      let mm: RegExpExecArray | null;
      while ((mm = re.exec(source)) !== null) {
        reads.add(mm[2]);
      }
    } catch {}

    // 2c) const k = "..." ; then ctx[k] (1-step constant propagation)
    try {
      const constMap = new Map<string, string>();
      const constDeclRe = /const\s+([A-Za-z_$][\w$]*)\s*=\s*(["'`])([^"'`]+)\2\s*;?/g;
      let mm: RegExpExecArray | null;
      while ((mm = constDeclRe.exec(source)) !== null) {
        constMap.set(mm[1], mm[3]);
      }
      if (constMap.size > 0) {
        const ctxIdRe = /ctx\s*\[\s*([A-Za-z_$][\w$]*)\s*\]/g;
        let m2: RegExpExecArray | null;
        while ((m2 = ctxIdRe.exec(source)) !== null) {
          const idName = m2[1];
          const value = constMap.get(idName);
          if (value) reads.add(value);
        }
      }
    } catch {}

    // 2d) legacy vars["..."]
    try {
      const re = /vars\s*\[\s*(["'`])([^"'`]+)\1\s*\]/g;
      let mm: RegExpExecArray | null;
      while ((mm = re.exec(source)) !== null) {
        reads.add(mm[2]);
      }
    } catch {}

    return Array.from(reads);
  } catch {
    return [];
  }
}

/**
 * Filters variables for tester: deduplicates case-insensitively and prefers first if multiple.
 */
export function filterVariablesForTester(variables: string[]): string[] {
  const usedArr = (variables || []).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];

  usedArr.forEach((k) => {
    const lc = String(k).toLowerCase();
    if (!seen.has(lc)) {
      seen.add(lc);
      out.push(k);
    }
  });

  // If multiple remain but the script logically handles a single input, prefer the first
  return out.length > 1 ? [out[0]] : out;
}
