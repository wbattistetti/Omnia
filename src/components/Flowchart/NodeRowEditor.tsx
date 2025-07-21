import React from 'react';

interface NodeRowEditorProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  placeholder?: string;
}

export const NodeRowEditor: React.FC<NodeRowEditorProps> = ({
  value,
  onChange,
  onKeyDown,
  inputRef,
  placeholder
}) => (
  <input
    ref={inputRef}
    type="text"
    value={value}
    onChange={onChange}
    onKeyDown={onKeyDown}
    autoFocus
    className="min-w-0 bg-slate-600 text-white text-[8px] px-1.5 py-1 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 border-2 border-purple-400 nodrag"
    style={{ width: '70%', maxWidth: '70%' }}
    placeholder={placeholder}
  />
); 