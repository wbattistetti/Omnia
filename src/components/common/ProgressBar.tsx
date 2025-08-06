import React from 'react';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  label?: string;
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ 
  currentStep, 
  totalSteps, 
  label = 'Progress',
  className = ''
}) => {
  const percentage = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
  
  return (
    <div className={className} style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 14, color: '#9ca3af' }}>
          {label}
        </span>
        <span style={{ fontSize: 14, color: '#9ca3af' }}>
          {currentStep} / {totalSteps}
        </span>
      </div>
      <div style={{ 
        width: '100%', 
        height: 6, 
        backgroundColor: 'rgba(255,255,255,0.1)', 
        borderRadius: 3 
      }}>
        <div 
          style={{ 
            width: `${percentage}%`, 
            height: '100%', 
            backgroundColor: '#a21caf', 
            borderRadius: 3,
            transition: 'width 0.3s ease'
          }} 
        />
      </div>
    </div>
  );
};

export default ProgressBar; 