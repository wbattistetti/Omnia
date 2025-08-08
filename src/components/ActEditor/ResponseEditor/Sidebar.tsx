import React from 'react';
import { getLabel } from './ddtSelectors';

interface SidebarProps {
  mainList: any[];
  selectedMainIndex: number;
  onSelectMain: (idx: number) => void;
}

export default function Sidebar({ mainList, selectedMainIndex, onSelectMain }: SidebarProps) {
  if (!mainList || mainList.length < 2) return null;
  return (
    <div style={{ width: 180, background: '#f3e8ff', padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 8, borderRight: '1px solid #e0d7f7' }}>
      {mainList.map((main, idx) => (
        <button
          key={idx}
          onClick={() => onSelectMain(idx)}
          style={{
            fontWeight: selectedMainIndex === idx ? 700 : 400,
            background: selectedMainIndex === idx ? '#7c3aed' : 'transparent',
            color: selectedMainIndex === idx ? '#fff' : '#7c3aed',
            border: 'none',
            borderRadius: 9999,
            padding: '10px 18px',
            margin: '0 12px',
            cursor: 'pointer',
            fontSize: 16,
            textAlign: 'left',
            transition: 'background 0.2s',
          }}
        >
          {getLabel(main)}
        </button>
      ))}
    </div>
  );
}

