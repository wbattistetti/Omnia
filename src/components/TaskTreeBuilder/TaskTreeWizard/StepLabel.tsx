import React from 'react';

interface StepLabelProps {
  icon: React.ReactNode;
  label: string;
}

const StepLabel: React.FC<StepLabelProps> = ({ icon, label }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: '#2563eb', lineHeight: 1 }}>
    {icon}
    <span>{label}</span>
  </span>
);

export default StepLabel; 