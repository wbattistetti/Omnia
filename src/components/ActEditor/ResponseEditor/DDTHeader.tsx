import React from 'react';
import { getLabel } from './ddtSelectors';

interface DDTHeaderProps {
  main: any;
  subList: any[];
  selectedSubIndex: number | null;
  onSelectMain: () => void;
  onSelectSub: (idx: number) => void;
}

export default function DDTHeader({ main, subList, selectedSubIndex, onSelectMain, onSelectSub }: DDTHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '16px 24px 8px 24px', background: 'transparent' }}>
      <button
        onClick={onSelectMain}
        style={{
          fontWeight: selectedSubIndex === null ? 700 : 400,
          background: selectedSubIndex === null ? '#7c3aed' : 'transparent',
          color: selectedSubIndex === null ? '#fff' : '#7c3aed',
          border: 'none',
          borderRadius: 9999,
          padding: '8px 20px',
          marginRight: 12,
          cursor: 'pointer',
          fontSize: 18,
          transition: 'background 0.2s',
        }}
      >
        {getLabel(main)}
      </button>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {subList.map((sub, idx) => (
          <button
            key={idx}
            onClick={() => onSelectSub(idx)}
            style={{
              fontWeight: selectedSubIndex === idx ? 700 : 400,
              background: selectedSubIndex === idx ? '#7c3aed' : 'transparent',
              color: selectedSubIndex === idx ? '#fff' : '#7c3aed',
              border: 'none',
              borderRadius: 9999,
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: 16,
              transition: 'background 0.2s',
              minWidth: 0,
            }}
          >
            {getLabel(sub)}
          </button>
        ))}
      </div>
    </div>
  );
}

