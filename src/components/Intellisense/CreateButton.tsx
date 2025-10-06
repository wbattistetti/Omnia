import React, { useState } from 'react';
import { Plus, ChevronDown, Loader2 } from 'lucide-react';

interface CreateButtonProps {
  scope: 'global' | 'industry';
  label: string;
  projectIndustry?: string;
  isCreating: boolean;
  creatingScope: 'global' | 'industry' | null;
  onClick: () => void;
  children?: React.ReactNode;
  className?: string;
  title?: string;
}

export const CreateButton: React.FC<CreateButtonProps> = ({
  scope,
  label,
  projectIndustry,
  isCreating,
  creatingScope,
  onClick,
  children,
  className = '',
  title
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  
  const isActive = isCreating && creatingScope === scope;
  const displayLabel = scope === 'industry' ? (projectIndustry || 'Industry') : label;
  
  const baseClasses = `flex items-center gap-1 px-2 py-1 text-xs text-white rounded transition-colors whitespace-nowrap ${className}`;
  const scopeClasses = scope === 'global' 
    ? 'bg-green-600 hover:bg-green-700' 
    : 'bg-blue-600 hover:bg-blue-700';

  const handleClick = () => {
    setShowDropdown(!showDropdown);
    onClick();
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className={`${baseClasses} ${scopeClasses}`}
        title={title}
      >
        {isActive ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Plus className="w-3 h-3" />
        )}
        {displayLabel}
        <ChevronDown className="w-3 h-3" />
      </button>
      
      {showDropdown && children}
    </div>
  );
};
