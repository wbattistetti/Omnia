import React from 'react';
import TaskBuilderAIWizardWrapper from './TaskBuilderAIWizardWrapper';

const DDTBuilder: React.FC<{ onCancel: () => void; onComplete?: (newDDT: any, messages?: any) => void; initialDDT?: any; startOnStructure?: boolean }> = ({ onCancel, onComplete, initialDDT, startOnStructure }) => {
  React.useEffect(() => {
    console.log('[DDTBuilder] Using new TaskBuilderAIWizard');
  });

  return (
    <TaskBuilderAIWizardWrapper
      onCancel={onCancel}
      onComplete={(ddt, messages) => {
        if (onComplete) onComplete(ddt, messages);
      }}
      initialTaskTree={initialDDT}
      startOnStructure={startOnStructure}
    />
  );
};

export default DDTBuilder;