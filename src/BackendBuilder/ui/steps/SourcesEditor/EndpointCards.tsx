import React from 'react';

export interface EndpointCard {
  id: string;
  method: string;
  path: string;
  purpose: string;
  inputs: Array<{ name: string; location: 'path'|'query'|'header'|'body'; type: string; domain?: string; example?: string; desc?: string; enumValues?: string[]; alias?: string }>;
  outputs: Array<{ status: number; desc: string; mainFields?: string[] }>;
  gaps?: string[];
}

interface EndpointCardsProps {
  endpoints: EndpointCard[];
}

export default function EndpointCards({ endpoints }: EndpointCardsProps) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {endpoints.map(ep => (
        <div key={ep.id} style={{ border: '1px solid #333', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #555', marginRight: 8 }}>{ep.method.toUpperCase()}</span>
              <strong>{ep.path}</strong>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ background: '#22c55e', color: '#0b1220', border: '1px solid #16a34a', borderRadius: 6, padding: '6px 10px', fontWeight: 700 }}>Mock</button>
              <button style={{ background: '#2563eb', color: '#fff', border: '1px solid #1d4ed8', borderRadius: 6, padding: '6px 10px', fontWeight: 700 }}>Codegen</button>
            </div>
          </div>
          <div style={{ color: '#9ca3af', marginTop: 4 }}>{ep.purpose}</div>
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Input</div>
              <table style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#9ca3af' }}>
                    <th>name</th><th>in</th><th>type</th><th>domain/example</th><th>alias</th>
                  </tr>
                </thead>
                <tbody>
                  {ep.inputs.map((p, i) => (
                    <tr key={i}>
                      <td>{p.name}</td><td>{p.location}</td><td>{p.type}</td><td>{p.domain || p.example || '-'}</td><td>{p.alias || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Output</div>
              <table style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#9ca3af' }}>
                    <th>status</th><th>desc</th><th>fields</th>
                  </tr>
                </thead>
                <tbody>
                  {ep.outputs.map((o, i) => (
                    <tr key={i}>
                      <td>{o.status}</td><td>{o.desc}</td><td>{(o.mainFields || []).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {ep.gaps && ep.gaps.length > 0 && (
            <div style={{ marginTop: 8, color: '#fbbf24', fontSize: 12 }}>Gaps: {ep.gaps.join('; ')}</div>
          )}
        </div>
      ))}
    </div>
  );
}


