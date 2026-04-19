/**
 * Opt-in diagnostics for standalone task contract persistence (editor save, project bulk save, reload, materialize).
 *
 * Enable in DevTools: localStorage.setItem('debug.contractPersist', '1') then reload the app.
 * Disable (stops all [ContractPersist:*] logs): localStorage.removeItem('debug.contractPersist') then reload.
 *
 * High-frequency materialize logs (`buildStandaloneTaskTreeView` on every hydrate): opt in with
 *   localStorage.setItem('debug.contractPersist.materialize', '1')
 * They do **not** require `debug.contractPersist` (that flag alone no longer spams this path).
 */

const STORAGE_KEY = 'debug.contractPersist';
const STORAGE_KEY_MATERIALIZE_VERBOSE = 'debug.contractPersist.materialize';

export function isContractPersistDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Per-call logs from `buildStandaloneTaskTreeView` (can run dozens of times per interaction). */
export function isContractPersistMaterializeVerboseEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY_MATERIALIZE_VERBOSE) === '1';
  } catch {
    return false;
  }
}

export type ContractPersistPhase =
  | 'editorSave'
  | 'bulkSave'
  | 'repoLoad'
  | 'materialize'
  | 'loadContract';

/**
 * Logs a single line with prefix [ContractPersist] when debug is enabled.
 */
export function logContractPersist(
  phase: ContractPersistPhase,
  message: string,
  data?: Record<string, unknown>
): void {
  if (!isContractPersistDebugEnabled()) return;
  const line = `[ContractPersist:${phase}] ${message}`;
  if (data !== undefined && Object.keys(data).length > 0) {
    console.info(line, data);
  } else {
    console.info(line);
  }
}

function engineTypesFromContract(dc: unknown): string[] {
  if (!dc || typeof dc !== 'object') return [];
  const eng = (dc as { engines?: unknown }).engines;
  if (!Array.isArray(eng)) return [];
  return eng.map((e: { type?: string }) => (typeof e?.type === 'string' ? e.type : '?'));
}

/**
 * Shallow summary of persisted subTasks tree / main tree nodes for logs (no full JSON).
 */
export function summarizeSubTasksForDebug(nodes: unknown): {
  count: number;
  perNode: Array<{ id?: string; hasDataContract: boolean; engineTypes: string[] }>;
} {
  if (!Array.isArray(nodes)) {
    return { count: 0, perNode: [] };
  }
  const perNode = nodes.map((n: any) => {
    const dc = n?.dataContract;
    const hasDataContract = !!(dc && typeof dc === 'object');
    return {
      id: typeof n?.id === 'string' ? n.id : undefined,
      hasDataContract,
      engineTypes: hasDataContract ? engineTypesFromContract(dc) : [],
    };
  });
  return { count: nodes.length, perNode };
}
