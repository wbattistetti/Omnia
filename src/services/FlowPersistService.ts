let pendingPayload: { pid: string; nodes: any[]; edges: any[] } | null = null;
let timer: any = null;

export function queueFlowPersist(pid: string, nodes: any[], edges: any[], delayMs: number = 120) {
  pendingPayload = { pid, nodes, edges };
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    const p = pendingPayload;
    pendingPayload = null;
    timer = null;
    if (!p) return;
    try {
      await fetch(`/api/projects/${encodeURIComponent(p.pid)}/flow`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodes: p.nodes, edges: p.edges })
      });
    } catch (e) {
      try { console.warn('[FlowPersistService] PUT failed', e); } catch {}
    }
  }, Math.max(0, delayMs | 0));
}

export function flushFlowPersist() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const p = pendingPayload;
  pendingPayload = null;
  if (!p) return Promise.resolve();
  return fetch(`/api/projects/${encodeURIComponent(p.pid)}/flow`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodes: p.nodes, edges: p.edges })
  }).catch((e) => { try { console.warn('[FlowPersistService] flush PUT failed', e); } catch {} });
}
