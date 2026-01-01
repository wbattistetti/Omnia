import React from 'react';

export default function NLPCompactEditor({
  synonymsText,
  setSynonymsText,
  formatText,
  setFormatText,
}: {
  synonymsText: string;
  setSynonymsText: (v: string) => void;
  formatText: string;
  setFormatText: (v: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: 'auto auto', gap: 12 }}>
      <div style={{ gridColumn: '1 / 2', gridRow: '1 / 2' }}>
        <label style={{ fontSize: 12, opacity: 0.8 }}>Synonyms (separati da virgola)</label>
        <textarea value={synonymsText} onChange={(e) => setSynonymsText(e.target.value)} rows={3} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 8 }} />
      </div>
      <div style={{ gridColumn: '1 / 2', gridRow: '2 / 3' }}>
        <label style={{ fontSize: 12, opacity: 0.8 }}>FormatHints (separati da virgola)</label>
        <textarea value={formatText} onChange={(e) => setFormatText(e.target.value)} rows={2} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 8 }} />
      </div>
    </div>
  );
}


