/**
 * Opt-in revisioning diagnostics for the dual-layer textarea pipeline.
 *
 * Enable (pick one):
 * - `localStorage.setItem('omnia.revisioningDebug', '1')` then reload (or type in editor — flag is read each call).
 * - `.env.local`: `VITE_REVISIONING_DEBUG=true` (forces on; useful if DEV was false or logs were missed).
 * - Console: `window.__omniaRevisioningDebug(true)` in dev.
 */

const STORAGE_KEY = 'omnia.revisioningDebug';

const viteRevisioningDebug = import.meta.env.VITE_REVISIONING_DEBUG === 'true';

/** Logs only in dev, unless VITE_REVISIONING_DEBUG forces diagnostics. */
function allowRevisioningDebugInfrastructure(): boolean {
  return import.meta.env.DEV || viteRevisioningDebug;
}

function readLocalStorageFlag(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

let sessionBannerShown = false;

/**
 * True when revisioning diagnostics should run (diff logs, insert/base resolution, textarea DESYNC warn).
 */
export function isRevisioningDebugEnabled(): boolean {
  if (!allowRevisioningDebugInfrastructure()) return false;
  const on = viteRevisioningDebug || readLocalStorageFlag();
  if (on && !sessionBannerShown && typeof console !== 'undefined') {
    sessionBannerShown = true;
    console.warn(
      '[revisioning] Debug logging is ON. You should see [revisioning] groups when editing structured sections. ' +
        'If not: Console filter must show "Verbose" / all levels; ensure this tab is focused; try typing in Behavior etc.'
    );
  }
  return on;
}

/** Persist opt-in for localStorage-based debugging. */
export function setRevisioningDebugEnabled(enabled: boolean): void {
  if (!allowRevisioningDebugInfrastructure()) return;
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function truncateForRevisioningLog(s: string, maxChars = 240): string {
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}… (${s.length} code units total)`;
}

/**
 * Grapheme count when Intl.Segmenter exists; otherwise code point count via iterator.
 */
export function revisioningGraphemeLikeCount(s: string): number {
  try {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      return [...seg.segment(s)].length;
    }
  } catch {
    /* fall through */
  }
  return [...s].length;
}

export function revisioningDebugGroup(title: string, fn: () => void): void {
  if (!isRevisioningDebugEnabled()) return;
  console.groupCollapsed(`[revisioning] ${title}`);
  try {
    fn();
  } finally {
    console.groupEnd();
  }
}

function installWindowRevisioningDebugApi(): void {
  type Api = {
    (enabled: boolean): void;
    (): void;
  };
  const w = window as unknown as { __omniaRevisioningDebug?: Api };
  const api = ((enabled?: boolean) => {
    if (enabled === undefined) {
      const on = isRevisioningDebugEnabled();
      console.info('[revisioning] status:', on ? 'ON' : 'OFF', {
        localStorage: readLocalStorageFlag(),
        VITE_REVISIONING_DEBUG: viteRevisioningDebug,
        DEV: import.meta.env.DEV,
      });
      console.info(
        '[revisioning] Enable: __omniaRevisioningDebug(true) or localStorage.setItem("omnia.revisioningDebug","1")'
      );
      return;
    }
    setRevisioningDebugEnabled(enabled);
    console.warn(
      enabled
        ? '[revisioning] enabled — edit text in a structured section (e.g. Behavior) to emit logs.'
        : '[revisioning] disabled.'
    );
  }) as Api;
  w.__omniaRevisioningDebug = api;
}

if (typeof window !== 'undefined' && allowRevisioningDebugInfrastructure()) {
  installWindowRevisioningDebugApi();
}
