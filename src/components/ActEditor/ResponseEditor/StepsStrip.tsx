import React from 'react';

interface StepsStripProps {
  stepKeys: string[];
  selectedStepKey: string;
  onSelectStep: (stepKey: string) => void;
}

export default function StepsStrip({ stepKeys, selectedStepKey, onSelectStep }: StepsStripProps) {
  if (!stepKeys.length) return null;
  return (
    <div style={{ display: 'flex', gap: 8, padding: '0 24px 8px 24px', overflowX: 'auto' }}>
      {stepKeys.map((key) => (
        <button
          key={key}
          onClick={() => onSelectStep(key)}
          style={{
            fontWeight: selectedStepKey === key ? 700 : 400,
            background: selectedStepKey === key ? '#7c3aed' : 'transparent',
            color: selectedStepKey === key ? '#fff' : '#7c3aed',
            border: 'none',
            borderRadius: 9999,
            padding: '6px 14px',
            cursor: 'pointer',
            fontSize: 15,
            transition: 'background 0.2s',
            minWidth: 0,
          }}
        >
          {key}
        </button>
      ))}
    </div>
  );
}

