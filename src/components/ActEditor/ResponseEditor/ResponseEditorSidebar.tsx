// Executive summary: Sidebar component for step selection in the Response Editor.
import React from 'react';
import styles from './ResponseEditor.module.css';

interface ResponseEditorSidebarProps {
  stepKeys: string[];
  selectedStep: string | null;
  onStepChange: (step: string) => void;
}

const ResponseEditorSidebar: React.FC<ResponseEditorSidebarProps> = ({
  stepKeys,
  selectedStep,
  onStepChange
}) => {
  const getStepLabel = (step: string) => {
    const labels: Record<string, string> = {
      start: 'Inizio',
      success: 'Successo',
      noMatch: 'Non capisco',
      noInput: 'Nessun input',
      normal: 'Normale',
      explicitConfirmation: 'Conferma esplicita',
      conditionalConfirmation: 'Conferma condizionale'
    };
    return labels[step] || step;
  };

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <h3>Step</h3>
      </div>
      <div className={styles.stepList}>
        {stepKeys.map((step) => (
          <button
            key={step}
            className={`${styles.stepButton} ${
              selectedStep === step ? styles.stepButtonActive : ''
            }`}
            onClick={() => onStepChange(step)}
          >
            {getStepLabel(step)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ResponseEditorSidebar; 