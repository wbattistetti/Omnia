import React from 'react';
import DDTWizard from './DDTWizard/DDTWizard';

const DDTBuilder: React.FC<{ onCancel: () => void; onComplete?: (newDDT: any, messages?: any) => void }> = ({ onCancel, onComplete }) => {
  React.useEffect(() => {
    console.log('[DDTBuilder] RENDER');
  });
  return <DDTWizard onCancel={onCancel} onComplete={(ddt, messages) => {
    console.log('[DDTBuilder] handleComplete CHIAMATO con:', ddt);
    if (onComplete) onComplete(ddt, messages);
  }} />;
};

export default DDTBuilder; 