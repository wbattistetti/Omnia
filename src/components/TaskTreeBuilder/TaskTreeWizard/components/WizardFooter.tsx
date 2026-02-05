// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { useFontContext } from '../../../../context/FontContext';

interface WizardFooterProps {
  onCancel: () => void;
}

const WizardFooter: React.FC<WizardFooterProps> = ({ onCancel }) => {
  const { combinedClass } = useFontContext();

  return (
    <div style={{ marginTop: 'auto', paddingTop: 24 }}>
      <button
        onClick={onCancel}
        className={combinedClass}
        style={{
          background: 'transparent',
          color: '#94a3b8',
          border: 'none',
          fontWeight: 500,
          cursor: 'pointer',
          padding: '6px 12px',
          fontSize: 13,
        }}
      >
        annulla
      </button>
    </div>
  );
};

export default WizardFooter;
