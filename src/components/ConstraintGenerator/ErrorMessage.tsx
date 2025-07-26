import React from 'react';

interface ErrorMessageProps {
  message: string;
  style?: React.CSSProperties;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, style }) => (
  <div style={{ color: '#ef4444', background: '#fff0f0', border: '1px solid #ef4444', borderRadius: 6, padding: '7px 12px', margin: '8px 0', fontSize: 15, ...style }}>
    {message}
  </div>
);

export default ErrorMessage; 