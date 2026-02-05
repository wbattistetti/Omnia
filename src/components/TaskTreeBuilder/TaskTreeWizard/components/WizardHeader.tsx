// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { useFontContext } from '../../../../context/FontContext';

interface WizardHeaderProps {
  message: {
    prefix: string;
    boldPart: string;
    suffix: string;
  };
  onConfirmCandidate?: () => void;
  onRejectCandidate?: () => void;
  candidateTemplate?: any;
}

const WizardHeader: React.FC<WizardHeaderProps> = ({
  message,
  onConfirmCandidate,
  onRejectCandidate,
  candidateTemplate,
}) => {
  const { combinedClass } = useFontContext();

  return (
    <>
      {/* Message */}
      <p
        style={{
          color: '#e2e8f0',
          fontSize: 15,
          lineHeight: 1.6,
          marginBottom: 20,
          fontWeight: 400,
          whiteSpace: 'pre-line',
        }}
      >
        {message.prefix}{' '}
        <span style={{ fontWeight: 700 }}>{message.boldPart}</span>
        {message.suffix}
      </p>

      {/* Candidate confirmation buttons */}
      {onConfirmCandidate && onRejectCandidate && candidateTemplate && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={onConfirmCandidate}
            className={combinedClass}
            style={{
              width: '100%',
              background: '#22c55e',
              color: '#fff',
              border: '1px solid #22c55e',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '10px 20px',
              marginBottom: 8,
              fontSize: 14,
            }}
          >
            Sì, usa questo template
          </button>
          <button
            onClick={onRejectCandidate}
            className={combinedClass}
            style={{
              width: '100%',
              background: 'transparent',
              color: '#e2e8f0',
              border: '1px solid #475569',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '10px 20px',
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            No, non va bene
          </button>
        </div>
      )}
    </>
  );
};

export default WizardHeader;
