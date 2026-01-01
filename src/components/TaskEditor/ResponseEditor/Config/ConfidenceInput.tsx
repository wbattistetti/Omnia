import React from 'react';

interface ConfidenceInputProps {
  value: number;
  onChange: (value: number) => void;
}

/**
 * Input for minimum confidence threshold (0-1)
 */
export default function ConfidenceInput({ value, onChange }: ConfidenceInputProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ fontSize: 12, opacity: 0.8, whiteSpace: 'nowrap' }}>Confidence</label>
      <input
        type="number"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: 80,
          padding: 6,
          border: '2px solid #9ca3af',
          borderRadius: 8,
        }}
      />
    </div>
  );
}

