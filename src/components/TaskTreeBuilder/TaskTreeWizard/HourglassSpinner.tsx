import React from 'react';

const HourglassSpinner: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '24px 0' }}>
    <svg width="36" height="36" viewBox="0 0 36 36" style={{ animation: 'spin 1.2s linear infinite' }}>
      <g>
        <ellipse cx="18" cy="7" rx="7" ry="4" fill="#2563eb" />
        <ellipse cx="18" cy="29" rx="7" ry="4" fill="#2563eb" />
        <path d="M11 11 Q18 18 11 25" stroke="#2563eb" strokeWidth="2.8" fill="none" />
        <path d="M25 11 Q18 18 25 25" stroke="#2563eb" strokeWidth="2.8" fill="none" />
        <ellipse cx="18" cy="18" rx="2.5" ry="1.2" fill="#2563eb" />
        <rect x="17.2" y="12" width="1.6" height="12" rx="0.8" fill="#2563eb" />
      </g>
    </svg>
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
  </div>
);

export default HourglassSpinner;