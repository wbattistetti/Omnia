import React from 'react';

export default function PostProcessEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ fontSize: 12, opacity: 0.8 }}>PostProcess (JSON)</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8, fontFamily: 'monospace' }}
      />
    </div>
  );
}


