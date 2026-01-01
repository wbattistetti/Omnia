import React from 'react';
import { getLabel } from './ddtSelectors';
import { HelpCircle } from 'lucide-react';

interface DDTHeaderProps {
  main: any;
  subList: any[];
  selectedSubIndex: number | null;
  onSelectMain: () => void;
  onSelectSub: (idx: number) => void;
}

function iconFor(node: any) {
  const name = (node?.icon || '').toString();
  // lazy dynamic import of lucide icon names is heavy; map minimal set or fallback
  // For now, render a generic placeholder if missing
  return name ? <span className={`lucide-${name}`} style={{ width: 16, height: 16 }} /> : <HelpCircle size={16} />;
}

export default function DDTHeader({ main, subList, selectedSubIndex, onSelectMain, onSelectSub }: DDTHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px 8px 16px', background: 'transparent' }}>
      <button
        onClick={onSelectMain}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: selectedSubIndex === null ? 700 : 500,
          background: selectedSubIndex === null ? '#fb923c' : 'transparent',
          color: selectedSubIndex === null ? '#0b1220' : '#fb923c',
          border: '1px solid #fb923c',
          borderRadius: 10,
          padding: '8px 14px',
          marginRight: 10,
          cursor: 'pointer',
          fontSize: 18,
          transition: 'background 0.2s',
        }}
      >
        <span>{iconFor(main)}</span>
        <span>{getLabel(main)}</span>
      </button>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {subList.map((sub, idx) => (
          <button
            key={idx}
            onClick={() => onSelectSub(idx)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: selectedSubIndex === idx ? 700 : 500,
              background: selectedSubIndex === idx ? '#fb923c' : 'transparent',
              color: selectedSubIndex === idx ? '#0b1220' : '#fb923c',
              border: '1px solid #fb923c',
              borderRadius: 10,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 16,
              transition: 'background 0.2s',
              minWidth: 0,
            }}
          >
            <span>{iconFor(sub)}</span>
            <span>{getLabel(sub)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

