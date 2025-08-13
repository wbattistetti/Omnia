import React from 'react';
import type { StepNotConfirmed } from '../../DialogueDataEngine/model/ddt.v2.types';

type Props = {
  value: StepNotConfirmed;
  onChange: (next: StepNotConfirmed) => void;
};

function ensure3(arr?: string[]): string[] {
  const a = Array.isArray(arr) ? arr.slice(0, 3) : [];
  while (a.length < 3) a.push('');
  return a;
}

export default function NotConfirmedEditor({ value, onChange }: Props) {
  const v = React.useMemo<StepNotConfirmed>(() => ({
    prompts: ensure3(value?.prompts),
    askWhatToFix: value?.askWhatToFix || '',
    options: value?.options || [],
    offerSkipAfter: value?.offerSkipAfter ?? 3,
    offerHandoffAfter: value?.offerHandoffAfter ?? 3,
  }), [value]);

  const setPrompt = (idx: number, text: string) => {
    const next = [...v.prompts];
    next[idx] = text;
    onChange({ ...v, prompts: next });
  };

  return (
    <div aria-label="v2-notconfirmed" style={{ display: 'grid', gap: 8 }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, color: '#6b7280' }}>Ask what to fix (optional)</label>
        <input
          aria-label="ask-what-to-fix"
          value={v.askWhatToFix || ''}
          onChange={(e) => onChange({ ...v, askWhatToFix: e.target.value })}
          style={{ width: '100%', border: '1px solid #ddd', padding: 8, borderRadius: 6 }}
          placeholder="e.g., Which part would you like to correct?"
        />
      </div>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Prompts (L1..L3)</div>
        {v.prompts.map((p, i) => (
          <input
            key={i}
            aria-label={`prompt-${i+1}`}
            value={p}
            onChange={(e) => setPrompt(i, e.target.value)}
            style={{ width: '100%', border: '1px solid #ddd', padding: 8, borderRadius: 6, marginBottom: 6 }}
            placeholder={`Prompt L${i + 1}`}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Offer skip after</span>
          <input
            aria-label="offer-skip-after"
            type="number"
            min={1}
            max={3}
            value={v.offerSkipAfter ?? 3}
            onChange={(e) => onChange({ ...v, offerSkipAfter: Number(e.target.value) })}
            style={{ width: 64, border: '1px solid #ddd', padding: 6, borderRadius: 6 }}
          />
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Offer handoff after</span>
          <input
            aria-label="offer-handoff-after"
            type="number"
            min={1}
            max={3}
            value={v.offerHandoffAfter ?? 3}
            onChange={(e) => onChange({ ...v, offerHandoffAfter: Number(e.target.value) })}
            style={{ width: 64, border: '1px solid #ddd', padding: 6, borderRadius: 6 }}
          />
        </label>
      </div>
    </div>
  );
}


