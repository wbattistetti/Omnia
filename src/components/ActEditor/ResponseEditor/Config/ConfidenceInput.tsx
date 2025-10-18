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
    <div>
      <label style={{ fontSize: 12, opacity: 0.8 }}>Confidence</label>
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
          border: '1px solid #ddd',
          borderRadius: 8,
        }}
      />
    </div>
  );
}

