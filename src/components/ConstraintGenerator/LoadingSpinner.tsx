import React from 'react';
import { Hourglass } from 'lucide-react';

interface LoadingSpinnerProps {
  color?: string;
  size?: number;
  message?: string;
  style?: React.CSSProperties;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ color = '#2563eb', size = 22, message, style }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...style }}>
    <Hourglass
      size={size}
      style={{
        color,
        animation: 'spin 1s linear infinite',
        flexShrink: 0
      }}
    />
    {message && <span style={{ color, fontSize: 15 }}>{message}</span>}
  </div>
);

export default LoadingSpinner;

// Nota: assicurati che @keyframes spin sia definito in index.css 