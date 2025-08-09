import React from 'react';

interface StepsStripProps {
  stepKeys: string[];
  selectedStepKey: string;
  onSelectStep: (stepKey: string) => void;
  node?: any; // optional, used to label constraint steps with AI-provided titles
}

export default function StepsStrip({ stepKeys, selectedStepKey, onSelectStep, node }: StepsStripProps) {
  if (!stepKeys.length) return null;

  const baseLabels: Record<string, string> = {
    start: 'Chiedo il dato',
    noMatch: 'Non capisco',
    noInput: 'Non sento',
    confirmation: 'Devo confermare',
    success: 'Ho capito!'
  };

  const getFriendlyLabel = (key: string): string => {
    if (baseLabels[key]) return baseLabels[key];
    const m = key.match(/^constraint\.(.+?)\.(r1|r2)$/);
    if (m && node && Array.isArray(node.constraints)) {
      const kind = m[1];
      const r = m[2];
      const c = node.constraints.find((x: any) => (x?.kind || '').toString() === kind);
      if (c && c.title) return `rule: ${c.title} ${r}`;
      if (c) return `rule: ${kind} ${r}`;
    }
    return key;
  };
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
          {getFriendlyLabel(key)}
        </button>
      ))}
    </div>
  );
}

