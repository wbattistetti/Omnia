import React from 'react';

interface ActionTextProps {
  text: string;
  editing: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  editValue: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

const ActionText: React.FC<ActionTextProps> = ({ text, editing, inputRef, editValue, onChange, onKeyDown }) => {
  if (!editing) {
    return text ? (
      <span style={{ color: '#fff', fontSize: 15, fontWeight: 500 }}>{text}</span>
    ) : (
      <span style={{ color: '#ef4444', fontSize: 15, fontStyle: 'italic' }}>Text missing...</span>
    );
  }
  return (
    <input
      ref={inputRef}
      value={editValue}
      onChange={e => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      style={{
        fontWeight: 500,
        fontSize: 15,
        padding: '6px 10px',
        border: '0.5px solid #bbb',
        borderRadius: 6,
        outline: 'none',
        boxShadow: 'none',
        minWidth: 80,
        width: '100%',
        boxSizing: 'border-box',
        background: '#fff',
        color: '#111',
        marginRight: 10,
      }}
    />
  );
};

export default React.memo(ActionText);
