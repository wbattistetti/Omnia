/**
 * Fails (exit 1) if forbidden legacy row/canvas writer patterns reappear.
 * Uses `rg` (ripgrep) on PATH. Windows: `winget install BurntSushi.ripgrep` or use Git Bash.
 */
import { execSync } from 'node:child_process';

const patterns = [
  { re: 'commitRowsToParent', path: 'src', glob: '*.{ts,tsx}' },
  { re: 'normalizedData\\.onUpdate', path: 'src/components/Flowchart', glob: '*.{ts,tsx}' },
  { re: 'deriveSyncedNodeRows', path: 'src', glob: '*.{ts,tsx}' },
  { re: 'useInternalRowManager', path: 'src', glob: '*.{ts,tsx}' },
];

function rgHasMatches(pattern, cwd, glob) {
  try {
    execSync(`rg "${pattern}" "${cwd}" --glob "${glob}"`, {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    return true;
  } catch (e) {
    const code = e?.status ?? e?.code;
    if (code === 1) return false;
    console.error('[verify-legacy-writers] rg failed — is ripgrep installed?', e?.message ?? e);
    process.exit(2);
  }
}

let failed = false;
for (const { re, path: p, glob } of patterns) {
  if (rgHasMatches(re, p, glob)) {
    console.error(`[verify-legacy-writers] FAIL: pattern matched: ${re} in ${p}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
console.log('[verify-legacy-writers] PASS');
