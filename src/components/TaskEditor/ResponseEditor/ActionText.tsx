import React from 'react';
import { VoiceTextbox } from '../../common/VoiceTextbox';
import VariableTokenText from '../../common/VariableTokenText';
import { useVariablePickerForFlow } from './hooks/useVariablePickerForFlow';

interface ActionTextProps {
  text: string;
  editing: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  editValue: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur?: (e: React.FocusEvent) => void;
}

const ActionText: React.FC<ActionTextProps> = ({ text, editing, inputRef, editValue, onChange, onKeyDown, onBlur }) => {
  const variablePicker = useVariablePickerForFlow({
    enabled: true,
    editing,
    draftValue: editValue,
    setDraftValue: onChange,
    inputRef,
  });

  if (!editing) {
    return text ? (
      <span style={{ color: '#fff', fontWeight: 500 }}>
        <VariableTokenText text={text} />
      </span>
    ) : (
      <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Scrivi un testo qui...</span>
    );
  }
  return (
    <>
      <VoiceTextbox
        ref={inputRef}
        value={editValue}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onContextMenu={variablePicker.onContextMenu}
        rows={1}
        style={{
          fontWeight: 500,
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
          resize: 'vertical',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      />
      {variablePicker.variableMenu}
    </>
  );
};

export default React.memo(ActionText);
