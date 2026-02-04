import React from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  const percentage = Math.round(progress * 100);
  const isComplete = percentage >= 100;

  // Colors: light orange for in-progress, solid GREEN for complete
  const barColor = isComplete ? '#22c55e' : '#fbbf24';

  // Style: dashed for in-progress, solid for complete
  const barStyle = isComplete
    ? { background: barColor }
    : {
        background: `repeating-linear-gradient(
          to right,
          ${barColor} 0px,
          ${barColor} 8px,
          transparent 8px,
          transparent 12px
        )`
      };

  return (
    <div style={{ width: '100%', height: 4, background: '#1f2937', borderRadius: 9999, overflow: 'hidden' }}>
      <div
        style={{
          width: `${percentage}%`,
          height: '100%',
          ...barStyle,
          transition: 'width 0.8s ease, background 0.3s ease'
        }}
      />
    </div>
  );
};

export default ProgressBar;

