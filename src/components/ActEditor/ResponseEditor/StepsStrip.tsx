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
  // DEBUG: Log per verificare cosa riceve StepsStrip
  console.log('[StepsStrip] Rendering', {
    stepKeysLength: stepKeys.length,
    stepKeys: JSON.stringify(stepKeys),
    selectedStepKey,
    nodeLabel: node?.label,
    willRender: stepKeys.length > 0,
    renderedButtons: stepKeys.length // Count of buttons that should be rendered
  });

  if (!stepKeys.length) {
    console.log('[StepsStrip] Returning null - no stepKeys', { stepKeys, stepKeysLength: stepKeys.length });
    return null;
  }

  // DEBUG: Verifica che stepKeys sia un array
  if (!Array.isArray(stepKeys)) {
    console.error('[StepsStrip] ERROR - stepKeys is not an array!', { stepKeys, type: typeof stepKeys });
    return null;
  }

  const baseLabels: Record<string, string> = {
    start: 'Chiedo il dato',
    noMatch: 'Non capisco',
    noInput: 'Non sento',
    confirmation: 'Devo confermare',
    success: 'Ho capito!',
    notConfirmed: 'Non Confermato',
    introduction: 'Introduzione'
  };

  const colorForStep = (key: string): string => {
    if ((stepMeta as any)[key]?.color) return (stepMeta as any)[key].color;
    if (/^constraint\./.test(key)) return '#fb923c';
    return '#7c3aed';
  };

  const iconForStep = (key: string): React.ReactNode => {
    if ((stepMeta as any)[key]?.icon) return (stepMeta as any)[key].icon;
    if (/^constraint\./.test(key)) return <Shield size={14} />;
    return null;
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
        flexWrap: 'nowrap',
        gap: 8,
        padding: '6px 16px 10px 16px',
        overflowX: 'auto'
      }}
    >
      {stepKeys.map((key, index) => {
        console.log(`[StepsStrip] Rendering button ${index}`, { key, selectedStepKey, nodeLabel: node?.label });
        const color = colorForStep(key);
        const selected = selectedStepKey === key;
        const label = getFriendlyLabel(key);
        return (
          <button
            key={key}
            type="button"
            aria-label={`Step ${label}`}
            onClick={() => onSelectStep(key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: selected ? 700 : 500,
              background: 'transparent',
              color: color,
              border: selected ? `3px solid ${color}` : `1px solid ${color}`,
              borderRadius: 10,
              padding: '5px 10px',
              cursor: 'pointer',
              fontSize: 13,
              transition: 'border 0.15s',
              minWidth: 0,
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <span>{iconForStep(key)}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

