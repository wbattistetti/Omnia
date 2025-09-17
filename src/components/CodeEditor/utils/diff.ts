// Unified diff parser/applicator (multi-hunk)
// Very compact but robust enough for chunk-wise application.
export interface Hunk {
  oldStart: number; oldLines: number; newStart: number; newLines: number;
  lines: string[]; // include +/-/space prefixes
  header: string;
}

export function parseUnifiedDiff(diff: string): Hunk[] {
  const hunks: Hunk[] = [];
  const lines = diff.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^@@\s*-(\d+),(\d+)\s*\+(\d+),(\d+)\s*@@/);
    if (m) {
      const h: Hunk = {
        oldStart: Number(m[1]), oldLines: Number(m[2]),
        newStart: Number(m[3]), newLines: Number(m[4]),
        lines: [], header: lines[i]
      };
      i++;
      while (i < lines.length && !lines[i].startsWith('@@')) {
        if (/^[ +\-]/.test(lines[i]) || lines[i] === '\\ No newline at end of file') h.lines.push(lines[i]);
        i++;
      }
      hunks.push(h);
    } else {
      i++;
    }
  }
  return hunks;
}

export function applyHunks(original: string, hunks: Hunk[], selected: boolean[]): { text: string; applied: number } {
  const origLines = original.split(/\r?\n/);
  let cursor = 0; const out: string[] = [];
  let applied = 0;
  for (let hi = 0; hi < hunks.length; hi++) {
    const h = hunks[hi];
    // copy unchanged region before hunk
    const copyUntil = h.oldStart - 1; // 1-based
    while (cursor < copyUntil && cursor < origLines.length) out.push(origLines[cursor++]);
    if (!selected[hi]) {
      // keep original lines
      for (let k = 0; k < h.oldLines; k++) out.push(origLines[cursor++]);
      continue;
    }
    // apply patch lines
    for (const l of h.lines) {
      if (l.startsWith('+')) out.push(l.slice(1));
      else if (l.startsWith(' ')) { out.push(origLines[cursor]); cursor++; }
      else if (l.startsWith('-')) { cursor++; }
    }
    applied++;
  }
  // copy remaining
  while (cursor < origLines.length) out.push(origLines[cursor++]);
  return { text: out.join('\n'), applied };
}




