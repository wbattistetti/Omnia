import React from 'react';
import TaskWizard from './TaskTreeWizard/TaskWizard';

const DDTBuilder: React.FC<{ onCancel: () => void; onComplete?: (newDDT: any, messages?: any) => void; initialDDT?: any; startOnStructure?: boolean }> = ({ onCancel, onComplete, initialDDT, startOnStructure }) => {
  React.useEffect(() => {
  });
  return (
    <TaskWizard
      onCancel={onCancel}
      onComplete={(ddt, messages) => { if (onComplete) onComplete(ddt, messages); }}
      initialDDT={initialDDT}
      startOnStructure={startOnStructure}
    />
  );
};

export default DDTBuilder;