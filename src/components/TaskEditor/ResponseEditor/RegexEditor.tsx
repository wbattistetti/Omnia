import React from 'react';

export default function RegexEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ fontSize: 12, opacity: 0.8 }}>Regex</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={"es. \\b\\d{5}\\b"}
        style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 8, fontFamily: 'monospace' }}
      />
    </div>
  );
}


