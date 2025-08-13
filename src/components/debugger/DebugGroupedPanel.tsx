import React from 'react';

export type LogEntry = { ts: number; kind: string; message: string; data?: any };

type Props = { logs: LogEntry[] };

export default function DebugGroupedPanel({ logs }: Props) {
  const groups = logs.reduce<Record<string, LogEntry[]>>((acc, l) => {
    acc[l.kind] = acc[l.kind] || [];
    acc[l.kind].push(l);
    return acc;
  }, {});

  const kinds = Object.keys(groups);

  return (
    <div aria-label="debug-grouped" style={{ border: '1px solid #eee', padding: 8, borderRadius: 6 }}>
      {kinds.length === 0 ? (
        <div style={{ color: '#777' }}>No logs</div>
      ) : (
        kinds.map((k) => (
          <div key={k} style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>{k}</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {groups[k].map((e, i) => (
                <li key={i} style={{ color: '#4b5563', fontSize: 13 }}>
                  <span style={{ color: '#9ca3af' }}>{new Date(e.ts).toLocaleTimeString()}</span> — {e.message}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}


