/**
 * Cross-host coordination for loadFlow / applyFlowLoadResult (idempotent hydrate).
 */

import { flowCanvasDiag } from '../components/Flowchart/utils/flowCanvasDiagnostics';
import { logFlowHydrationTrace } from '../utils/flowHydrationTrace';
import type { ApplyFlowLoadPayload } from './ApplyFlowLoadPayload';

const inFlightKeys = new Set<string>();
const inFlightCallerByKey = new Map<string, string>();
const loadEndWaiters = new Map<string, Array<() => void>>();
const lastAppliedFingerprint = new Map<string, string>();
const lastGraphHydratedFingerprint = new Map<string, string>();

function notifyFlowLoadEnded(key: string): void {
  const waiters = loadEndWaiters.get(key);
  if (!waiters?.length) return;
  loadEndWaiters.delete(key);
  for (const resolve of waiters) resolve();
}

export function flowLoadKey(projectId: string, flowId: string): string {
  return `${String(projectId || '').trim()}|${String(flowId || '').trim()}`;
}

/** Stable fingerprint for server payload (nodes positions + topology). */
export function fingerprintFlowLoadPayload(payload: ApplyFlowLoadPayload): string {
  const nodes = payload.nodes ?? [];
  const edges = payload.edges ?? [];
  const nodeSig = nodes
    .map((n: { id?: string; position?: { x?: number; y?: number } }) => {
      const id = String(n?.id ?? '');
      const x = Number(n?.position?.x);
      const y = Number(n?.position?.y);
      return `${id}:${Number.isFinite(x) ? x.toFixed(2) : '?'},${Number.isFinite(y) ? y.toFixed(2) : '?'}`;
    })
    .sort()
    .join(';');
  const edgeSig = edges
    .map((e: { id?: string; source?: string; target?: string }) =>
      `${String(e?.id ?? '')}>${String(e?.source ?? '')}->${String(e?.target ?? '')}`
    )
    .sort()
    .join(';');
  return `n${nodes.length}e${edges.length}|${nodeSig}|${edgeSig}`;
}

function traceFlowLoadLock(
  action: 'begin' | 'skip' | 'end',
  key: string,
  caller?: string,
  extra?: Record<string, unknown>
): void {
  const payload = { key, caller, ...extra };
  logFlowHydrationTrace(`flowLoadLock:${action}`, payload);
  flowCanvasDiag(`hydrate.lock.${action}`, payload);
}

/** @param caller Short label for logs (e.g. FlowCanvasHost, prefetch). */
export function beginFlowLoad(projectId: string, flowId: string, caller?: string): boolean {
  const key = flowLoadKey(projectId, flowId);
  if (inFlightKeys.has(key)) {
    traceFlowLoadLock('skip', key, caller, {
      heldBy: inFlightCallerByKey.get(key),
    });
    return false;
  }
  inFlightKeys.add(key);
  if (caller) inFlightCallerByKey.set(key, caller);
  traceFlowLoadLock('begin', key, caller);
  return true;
}

/** @param caller Should match the caller passed to beginFlowLoad when possible. */
export function endFlowLoad(projectId: string, flowId: string, caller?: string): void {
  const key = flowLoadKey(projectId, flowId);
  inFlightKeys.delete(key);
  inFlightCallerByKey.delete(key);
  traceFlowLoadLock('end', key, caller);
  // Defer so FlowStore reducer + provider snapshot ref update before waiters re-check the slice.
  queueMicrotask(() => notifyFlowLoadEnded(key));
}

const sharedWaitByKey = new Map<string, Promise<void>>();

/** One awaited load lock per flow — multiple FlowCanvasHost effects share the same wait. */
export function waitForFlowLoadIdleShared(projectId: string, flowId: string): Promise<void> {
  const key = flowLoadKey(projectId, flowId);
  const existing = sharedWaitByKey.get(key);
  if (existing) return existing;
  const p = waitForFlowLoadIdle(projectId, flowId).finally(() => {
    sharedWaitByKey.delete(key);
  });
  sharedWaitByKey.set(key, p);
  return p;
}

/**
 * Resolves when no loadFlow is in flight for this project+flow (used when another host holds the lock).
 */
export function waitForFlowLoadIdle(
  projectId: string,
  flowId: string,
  timeoutMs = 30_000
): Promise<void> {
  const key = flowLoadKey(projectId, flowId);
  if (!inFlightKeys.has(key)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      detach();
      reject(new Error(`waitForFlowLoadIdle timeout: ${key}`));
    }, timeoutMs);

    const onEnd = () => {
      clearTimeout(timer);
      detach();
      resolve();
    };

    const detach = () => {
      const list = loadEndWaiters.get(key);
      if (!list) return;
      const next = list.filter((w) => w !== onEnd);
      if (next.length) loadEndWaiters.set(key, next);
      else loadEndWaiters.delete(key);
    };

    const list = loadEndWaiters.get(key) ?? [];
    list.push(onEnd);
    loadEndWaiters.set(key, list);

    if (!inFlightKeys.has(key)) {
      clearTimeout(timer);
      detach();
      resolve();
    }
  });
}

export function isFlowLoadInFlight(projectId: string, flowId: string): boolean {
  return inFlightKeys.has(flowLoadKey(projectId, flowId));
}

/**
 * Skip apply when the same payload was already applied for this flowId
 * and the slice already has a hydrated non-empty graph.
 */
export function shouldApplyFlowLoadResult(
  flowId: string,
  payload: ApplyFlowLoadPayload,
  slice: { hydrated?: boolean; nodes?: unknown[]; edges?: unknown[] } | undefined
): boolean {
  const fp = fingerprintFlowLoadPayload(payload);
  const nodeCount = slice?.nodes?.length ?? 0;
  const edgeCount = slice?.edges?.length ?? 0;
  const last = lastAppliedFingerprint.get(flowId);
  if (last === fp && slice?.hydrated === true && (nodeCount > 0 || edgeCount > 0)) {
    return false;
  }
  return true;
}

export function markFlowLoadResultApplied(flowId: string, payload: ApplyFlowLoadPayload): void {
  lastAppliedFingerprint.set(flowId, fingerprintFlowLoadPayload(payload));
}

/** Emit GRAPH_HYDRATED at most once per flowId + payload fingerprint. */
export function shouldEmitGraphHydrated(flowId: string, payload: ApplyFlowLoadPayload): boolean {
  const fp = fingerprintFlowLoadPayload(payload);
  if (lastGraphHydratedFingerprint.get(flowId) === fp) return false;
  lastGraphHydratedFingerprint.set(flowId, fp);
  return true;
}

export function clearFlowLoadCoordinator(flowId?: string): void {
  if (flowId) {
    lastAppliedFingerprint.delete(flowId);
    lastGraphHydratedFingerprint.delete(flowId);
    for (const key of inFlightKeys) {
      if (key.endsWith(`|${flowId}`)) {
        inFlightKeys.delete(key);
        inFlightCallerByKey.delete(key);
        loadEndWaiters.delete(key);
      }
    }
    return;
  }
  inFlightKeys.clear();
  inFlightCallerByKey.clear();
  loadEndWaiters.clear();
  lastAppliedFingerprint.clear();
  lastGraphHydratedFingerprint.clear();
}
