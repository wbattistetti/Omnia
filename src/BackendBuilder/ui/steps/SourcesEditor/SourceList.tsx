import React from 'react';

export interface SourceItem {
  id: string;
  name: string;
  type: 'openapi' | 'postman' | 'grpc' | 'graphql' | 'soap' | 'doc';
  endpoints: number;
}

interface SourceListProps {
  items: SourceItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export default function SourceList({ items, selectedId, onSelect }: SourceListProps) {
  return (
    <div style={{ border: '1px solid #333', borderRadius: 8, padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Sorgenti</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
        {items.map(s => (
          <li key={s.id}>
            <button
              onClick={() => onSelect(s.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 6,
                background: selectedId === s.id ? '#1f2937' : 'transparent', color: '#ddd', border: '1px solid #222'
              }}
              title={`${s.type.toUpperCase()} • ${s.endpoints} endpoint`}
            >
              {s.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}



