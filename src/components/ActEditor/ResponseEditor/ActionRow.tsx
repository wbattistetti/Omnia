import React, { useState, useRef } from 'react';
import { Trash2, Bot } from 'lucide-react';
import SmartTooltip from '../../SmartTooltip';
import { TooltipWrapper } from '../../TooltipWrapper';
import AIActionPanel from './AIActionPanel';

interface ActionRowProps {
  icon?: React.ReactNode;
  label?: string;
  text: string;
  color?: string;
  onEdit?: (newText: string) => void;
  onDelete?: () => void;
  onAIGenerate?: (exampleMessage: string, applyToAll: boolean) => void;
  stepType?: string;
  draggable?: boolean;
  selected?: boolean;
  dndPreview?: 'before' | 'after';
}

const ActionRow: React.FC<ActionRowProps> = ({ 
  icon, 
  label, 
  text, 
  color = '#a21caf', 
  onEdit, 
  onDelete, 
  onAIGenerate,
  stepType,
  draggable, 
  selected, 
  dndPreview 
}) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(text);
  const [hovered, setHovered] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleEdit = () => {
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  const handleEditBlur = () => {
    setEditing(false);
    setEditValue(text); // Blur cancels edit
  };
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (onEdit && editValue !== text) onEdit(editValue);
      setEditing(false);
    }
    if (e.key === 'Escape') {
      setEditing(false);
      setEditValue(text);
    }
  };
  const handleEditConfirm = () => {
    if (onEdit && editValue !== text) onEdit(editValue);
    setEditing(false);
  };
  const handleEditCancel = () => {
    setEditing(false);
    setEditValue(text);
  };

  const handleAIGenerate = async (exampleMessage: string, applyToAll: boolean) => {
    if (onAIGenerate) {
      setIsGenerating(true);
      try {
        await onAIGenerate(exampleMessage, applyToAll);
        setAiPanelOpen(false);
      } catch (error) {
        console.error('AI generation failed:', error);
      } finally {
        setIsGenerating(false);
      }
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: selected ? '#ede9fe' : 'transparent',
          border: selected ? `2px solid ${color}` : 'none',
          borderRadius: 8,
          padding: '8px 0',
          marginBottom: 6,
          boxShadow: selected ? `0 2px 8px 0 ${color}22` : undefined,
          cursor: draggable ? 'grab' : 'default',
          transition: 'background 0.15s, border 0.15s',
          position: 'relative',
          borderTop: dndPreview === 'before' ? '2px solid #2563eb' : undefined,
          borderBottom: dndPreview === 'after' ? '2px solid #2563eb' : undefined,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
      {icon && <span style={{ color, display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {label && <span style={{ fontWeight: 600, color, marginRight: 8 }}>{label}</span>}
      <span style={{ flex: 1, color: '#fff', fontSize: 15 }}>
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleEditBlur}
            onKeyDown={handleEditKeyDown}
            style={{
              fontWeight: 500,
              fontSize: 15,
              padding: '6px 10px',
              border: '0.5px solid #bbb', // ultra-thin border all around
              borderRadius: 6,
              outline: 'none',
              boxShadow: 'none',
              minWidth: 80,
              width: '100%',
              boxSizing: 'border-box',
              background: '#fff',
              color: '#111',
            }}
          />
        ) : (
          text
        )}
      </span>
      {/* Editing controls: show only when editing */}
      {editing && (
        <>
          {/* Confirm (checkmark) */}
          <TooltipWrapper tooltip={<SmartTooltip text="Conferma modifica" tutorId="action_confirm"><span /></SmartTooltip>}>
            {(show, triggerProps) => (
              <button
                {...triggerProps}
                onClick={handleEditConfirm}
                style={{ background: 'none', border: 'none', color: '#22c55e', cursor: 'pointer', marginRight: 4, fontSize: 20, display: 'flex', alignItems: 'center', position: 'relative' }}
                tabIndex={-1}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 11 9 16 17 6" /></svg>
              </button>
            )}
          </TooltipWrapper>
          {/* Cancel (X) */}
          <TooltipWrapper tooltip={<SmartTooltip text="Annulla modifica" tutorId="action_cancel"><span /></SmartTooltip>}>
            {(show, triggerProps) => (
              <button
                {...triggerProps}
                onClick={handleEditCancel}
                style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', marginRight: 4, fontSize: 20, display: 'flex', alignItems: 'center', position: 'relative' }}
                tabIndex={-1}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="6" x2="14" y2="14" /><line x1="14" y1="6" x2="6" y2="14" /></svg>
              </button>
            )}
          </TooltipWrapper>
          {/* Delete (trash) */}
          {onDelete && (
            <TooltipWrapper tooltip={<SmartTooltip text="Elimina messaggio" tutorId="action_delete"><span /></SmartTooltip>}>
              {(show, triggerProps) => (
                <button
                  {...triggerProps}
                  onClick={onDelete}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', position: 'relative' }}
                  tabIndex={-1}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </TooltipWrapper>
          )}
        </>
      )}
      {/* Show pencil, AI, and trash on hover if not editing */}
      {!editing && hovered && onEdit && (
        <TooltipWrapper tooltip={<SmartTooltip text="Modifica messaggio" tutorId="action_edit"><span /></SmartTooltip>}>
          {(show, triggerProps) => (
            <button
              {...triggerProps}
              onClick={handleEdit}
              style={{ background: 'none', border: 'none', color: color, cursor: 'pointer', marginRight: 6, fontSize: 18, display: 'flex', alignItems: 'center', position: 'relative' }}
              tabIndex={-1}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
            </button>
          )}
        </TooltipWrapper>
      )}
      {!editing && hovered && onAIGenerate && stepType && (
        <TooltipWrapper tooltip={
          <SmartTooltip text="AI-powered message refinement" tutorId="ai_refinement">
            <span />
          </SmartTooltip>
        }>
          {(show, triggerProps) => (
            <button
              {...triggerProps}
              onClick={() => setAiPanelOpen(!aiPanelOpen)}
              style={{
                background: 'none',
                border: 'none',
                color: '#a21caf',
                cursor: 'pointer',
                marginRight: 6,
                fontSize: 18,
                display: 'flex',
                alignItems: 'center',
                position: 'relative'
              }}
              title="AI Refinement"
            >
              <Bot size={18} />
            </button>
          )}
        </TooltipWrapper>
      )}
      {!editing && hovered && onDelete && (
        <button onClick={onDelete} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center' }} title="Elimina messaggio" tabIndex={-1}>
          <Trash2 size={18} />
        </button>
      )}
      </div>
      
      {/* AI Panel */}
      {aiPanelOpen && onAIGenerate && stepType && (
        <AIActionPanel
          currentMessage={text}
          stepType={stepType}
          onGenerate={handleAIGenerate}
          onClose={() => setAiPanelOpen(false)}
          isGenerating={isGenerating}
        />
      )}
    </div>
  );
};

export default ActionRow;