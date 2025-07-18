import React from 'react';

interface NodeRowEditorProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  placeholder?: string;
}

export const NodeRowEditor: React.FC<NodeRowEditorProps> = ({
  value, onChange, onKeyDown, inputRef, placeholder
}) => (
  <input
    ref={inputRef}
    type="text"
    value={value}
    onChange={onChange}
    onKeyDown={onKeyDown}
    className="flex-1 bg-white text-black text-[8px] px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 border border-black nodrag"
    autoFocus
    placeholder={placeholder || "Type what you need here..."}
  />
); 