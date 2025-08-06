import React from 'react';
import DDTWizard from './DDTWizard/DDTWizard';

const DDTBuilder: React.FC<{ onCancel: () => void; onComplete?: (newDDT: any, messages?: any) => void }> = ({ onCancel, onComplete }) => {
  React.useEffect(() => {
  });
  return <DDTWizard onCancel={onCancel} onComplete={(ddt, messages) => {
    if (onComplete) onComplete(ddt, messages);
  }} />;
};

export default DDTBuilder; 