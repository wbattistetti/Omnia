import React from 'react';
import HourglassSpinner from './HourglassSpinner';

interface WizardLoadingStepProps {
  friendlyMessage?: string; // ✅ Messaggio amichevole opzionale
}

const WizardLoadingStep: React.FC<WizardLoadingStepProps> = ({
  friendlyMessage = 'Un momento, sto cercando di capire che tipo di dato ti serve…'
}) => (
  <div style={{ padding: 32, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
    <HourglassSpinner />
    <div style={{ color: '#e2e8f0', fontWeight: 400, fontSize: 15, marginTop: 16, lineHeight: 1.6 }}>
      {friendlyMessage}
    </div>
  </div>
);

export default WizardLoadingStep;