import React from 'react';

interface DataTypeLabelProps {
  icon: React.ReactNode;
  label: string;
}

const DataTypeLabel: React.FC<DataTypeLabelProps> = ({ icon, label }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, color: '#a21caf', lineHeight: 1 }}>
    {icon}
    <span>{label}</span>
  </span>
);

export default DataTypeLabel; 