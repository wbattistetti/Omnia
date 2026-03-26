import React from 'react';
import { VoiceTextbox } from '../../common/VoiceTextbox';
import VariableTokenText from '../../common/VariableTokenText';
import VariableTokenContextMenu from '../../common/VariableTokenContextMenu';
import { insertBracketTokenAtCaret } from '../../../utils/variableTokenText';
import { getActiveFlowCanvasId } from '../../../flows/activeFlowCanvas';
import { useFlowActions, useFlowWorkspace } from '../../../flows/FlowStore';
import { useProjectDataUpdate } from '../../../context/ProjectDataContext';
import { buildVariableMenuItems } from '../../common/variableMenuModel';

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
  const [varsMenu, setVarsMenu] = React.useState<{ open: boolean; x: number; y: number }>({ open: false, x: 0, y: 0 });
  const { flows } = useFlowWorkspace();
  const { updateFlowMeta } = useFlowActions();
  const pdUpdate = useProjectDataUpdate();
  const activeFlowId = getActiveFlowCanvasId();
  const variableMenuItems = React.useMemo(() => {
    const pid = pdUpdate?.getCurrentProjectId() || '';
    if (!pid) return [];
    return buildVariableMenuItems(pid, activeFlowId, flows as any);
  }, [pdUpdate, activeFlowId, flows, editing, text]);

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
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setVarsMenu({ open: true, x: e.clientX, y: e.clientY });
        }}
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
      <VariableTokenContextMenu
        isOpen={varsMenu.open}
        x={varsMenu.x}
        y={varsMenu.y}
        variables={variableMenuItems.map((i) => i.varLabel)}
        variableItems={variableMenuItems}
        onClose={() => setVarsMenu({ open: false, x: 0, y: 0 })}
        onExposeAndSelect={(item) => {
          const owner = (flows as any)?.[item.ownerFlowId];
          if (!owner) return;
          const prevVars = Array.isArray(owner?.meta?.variables) ? owner.meta.variables : [];
          const existing = prevVars.find((v: any) => String(v?.id || '').trim() === item.varId);
          const nextVars = existing
            ? prevVars.map((v: any) => (String(v?.id || '').trim() === item.varId ? { ...v, visibility: 'output' } : v))
            : [...prevVars, { id: item.varId, label: item.varLabel, type: 'string', visibility: 'output' }];
          updateFlowMeta(item.ownerFlowId, { variables: nextVars });

          const el = inputRef.current;
          const caret = {
            start: el?.selectionStart ?? editValue.length,
            end: el?.selectionEnd ?? editValue.length,
          };
          const out = insertBracketTokenAtCaret(editValue, caret, item.tokenLabel || item.varLabel);
          onChange(out.text);
          setVarsMenu({ open: false, x: 0, y: 0 });
          requestAnimationFrame(() => {
            if (!el) return;
            el.focus();
            el.setSelectionRange(out.caret.start, out.caret.end);
          });
        }}
        onSelect={(label) => {
          const el = inputRef.current;
          const caret = {
            start: el?.selectionStart ?? editValue.length,
            end: el?.selectionEnd ?? editValue.length,
          };
          const out = insertBracketTokenAtCaret(editValue, caret, label);
          onChange(out.text);
          setVarsMenu({ open: false, x: 0, y: 0 });
          requestAnimationFrame(() => {
            if (!el) return;
            el.focus();
            el.setSelectionRange(out.caret.start, out.caret.end);
          });
        }}
      />
    </>
  );
};

export default React.memo(ActionText);
