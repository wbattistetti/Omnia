import React, { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';

interface AddButtonProps {
  label: string;
  onAdd: (name: string) => void;
  placeholder?: string;
  className?: string;
}

export const AddButton: React.FC<AddButtonProps> = ({ 
  label, 
  onAdd, 
  placeholder = "Enter name...",
  className = "" 
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');

  const handleAdd = () => {
    const trimmedName = name.trim();
    if (trimmedName) {
      onAdd(trimmedName);
      setName('');
      setIsAdding(false);
    }
  };

  const handleCancel = () => {
    setName('');
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isAdding) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-slate-600 text-white px-2 py-1 rounded border border-slate-500 focus:outline-none focus:border-purple-500 text-sm"
          autoFocus
        />
        <button
          onClick={handleAdd}
          className="p-1 text-green-400 hover:text-green-300 transition-colors"
          disabled={!name.trim()}
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1 text-red-400 hover:text-red-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsAdding(true)}
      className={`flex items-center space-x-2 text-blue-500 hover:text-blue-700 transition-colors text-sm ${className}`}
    >
      <Plus className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
};