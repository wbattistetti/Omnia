import React from 'react';

interface PanelHeaderProps {
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
}

const PanelHeader: React.FC<PanelHeaderProps> = ({ children, color = '#23232b', style }) => (
  <div
    style={{
      background: color,
      color: '#fff',
      textAlign: 'center',
      fontWeight: 600,
      fontSize: 16,
      letterSpacing: 0.2,
      padding: '7px 0 5px 0',
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      borderBottom: '1px solid #a3a3a3',
      userSelect: 'none',
      ...style
    }}
  >
    {children}
  </div>
);

export default PanelHeader; 