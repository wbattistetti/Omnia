import React from 'react';
import { stepMeta } from './ddtUtils';
import { Shield } from 'lucide-react';

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

  const colorForStep = (key: string): string => {
    if ((stepMeta as any)[key]?.color) return (stepMeta as any)[key].color;
    // Virtual constraint steps: use orange
    if (/^constraint\./.test(key)) return '#fb923c';
    return '#7c3aed';
  };

  const iconForStep = (key: string): React.ReactNode => {
    if ((stepMeta as any)[key]?.icon) return (stepMeta as any)[key].icon;
    if (/^constraint\./.test(key)) return <Shield size={14} />;
    return null;
  };

  const hexToRgba = (hex: string, alpha: number) => {
    const m = hex.replace('#', '');
    const r = parseInt(m.substring(0, 2), 16);
    const g = parseInt(m.substring(2, 4), 16);
    const b = parseInt(m.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        rowGap: 10,
        padding: '6px 16px 10px 16px'
      }}
    >
      {stepKeys.map((key) => {
        const color = colorForStep(key);
        const selected = selectedStepKey === key;
        return (
          <button
            key={key}
            onClick={() => onSelectStep(key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: selected ? 700 : 500,
              background: selected ? hexToRgba(color, 0.18) : 'transparent',
              color: color,
              border: selected ? `4px solid ${color}` : `1px solid ${color}`,
              borderRadius: 10,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 14,
              transition: 'background 0.2s, border 0.15s',
              minWidth: 0,
            }}
          >
            <span>{iconForStep(key)}</span>
            <span>{getFriendlyLabel(key)}</span>
          </button>
        );
      })}
    </div>
  );
}

