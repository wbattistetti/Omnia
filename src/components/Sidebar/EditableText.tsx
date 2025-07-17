import React, { useState, useRef, useEffect } from 'react';
import { Edit3 } from 'lucide-react';

interface EditableTextProps {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
  showEditIcon?: boolean;
}

export const EditableText: React.FC<EditableTextProps> = ({ 
  value, 
  onSave, 
  placeholder = "Enter text...", 
  className = "",
  showEditIcon = true 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(value);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmedText = text.trim();
    if (trimmedText !== value) {
      onSave(trimmedText);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setText(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`bg-slate-600 text-white px-2 py-1 rounded border border-slate-500 focus:outline-none focus:border-purple-500 ${className}`}
      />
    );
  }

  return (
    <div 
      className={`flex items-center group cursor-pointer ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setIsEditing(true)}
    >
      <span className="text-slate-200 hover:text-white transition-colors">
        {value || placeholder}
      </span>
      {showEditIcon && isHovered && (
        <Edit3 className="w-3 h-3 ml-2 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
};