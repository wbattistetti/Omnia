import React from 'react';
import DDTWizard from './DDTWizard/DDTWizard';

const DDTBuilder: React.FC<{ onCancel: () => void; onComplete?: (newDDT: any, messages?: any) => void; initialDDT?: any; startOnStructure?: boolean }> = ({ onCancel, onComplete, initialDDT, startOnStructure }) => {
  React.useEffect(() => {
  });
  return (
    <DDTWizard
      onCancel={onCancel}
      onComplete={(ddt, messages) => { if (onComplete) onComplete(ddt, messages); }}
      initialDDT={initialDDT}
      startOnStructure={startOnStructure}
    />
  );
};

export default DDTBuilder; 