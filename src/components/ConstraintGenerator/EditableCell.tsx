import React, { useState } from 'react';
import { EditableCellProps } from './types';
import { PLACEHOLDER_TEST_DESC } from './constants';

const EditableCell: React.FC<EditableCellProps> = ({ value, onChange, placeholder = PLACEHOLDER_TEST_DESC }) => {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value);
  return editing ? (
    <input
      autoFocus
      value={temp}
      onChange={e => setTemp(e.target.value)}
      onBlur={() => { setEditing(false); onChange(temp); }}
      onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); onChange(temp); }}}
      style={{ width: '100%', border: 'none', background: 'transparent', color: '#fff', outline: 'none', fontSize: 15 }}
      placeholder={placeholder}
    />
  ) : (
    <span
      style={{ cursor: 'pointer', minHeight: 24, display: 'inline-block', color: value ? '#fff' : '#888' }}
      onClick={() => setEditing(true)}
    >
      {value || placeholder || '—'}
    </span>
  );
};

export default EditableCell; 