import React from 'react';

const ToolbarButton: React.FC<{ label: string; active?: boolean; onClick?: () => void }> = ({ 
  label, 
  active = false, 
  onClick 
}) => (
  <button
    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors
      ${active 
        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
      }`}
    onClick={onClick}
  >
    {label}
  </button>
);

export default ToolbarButton; 