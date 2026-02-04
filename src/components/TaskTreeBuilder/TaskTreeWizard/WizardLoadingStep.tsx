import React from 'react';
import HourglassSpinner from './HourglassSpinner';

const WizardLoadingStep: React.FC = () => (
  <div style={{ padding: 32, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
    <HourglassSpinner />
    <div style={{ color: '#fff', fontWeight: 600, fontSize: 17, marginTop: 16 }}>Identifying data type...</div>
  </div>
);

export default WizardLoadingStep;