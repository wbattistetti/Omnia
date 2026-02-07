import React from 'react';

/**
 * Unified color time bar with thresholds: >200ms yellow, >1000ms red
 */
export function renderTimeBar(ms?: number, maxMs?: number) {
  const m = typeof ms === 'number' && ms > 0 ? ms : 0;
  const max = Math.max(1, typeof maxMs === 'number' && maxMs > 0 ? maxMs : 1);
  let remaining = Math.min(m, max);
  const seg1Ms = Math.min(200, remaining); remaining -= seg1Ms;
  const seg2Ms = Math.min(800, Math.max(0, remaining)); remaining -= seg2Ms;
  const seg3Ms = Math.max(0, remaining);
  const seg1Pct = (seg1Ms / max) * 100;
  const seg2Pct = (seg2Ms / max) * 100;
  const seg3Pct = (seg3Ms / max) * 100;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ height: 4, width: '100%', background: '#e5e7eb', borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
        {seg1Pct > 0 && <div style={{ height: 4, width: `${seg1Pct}%`, background: '#64748b' }} />}
        {seg2Pct > 0 && <div style={{ height: 4, width: `${seg2Pct}%`, background: '#fbbf24' }} />}
        {seg3Pct > 0 && <div style={{ height: 4, width: `${seg3Pct}%`, background: '#ef4444' }} />}
      </div>
      <div style={{ opacity: 0.75, marginTop: 2 }}>{m ? `${m} ms` : ''}</div>
    </div>
  );
}
