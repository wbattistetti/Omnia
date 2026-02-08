// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { X, Pencil, Check } from 'lucide-react';
import { SIDEBAR_ICON_COMPONENTS, SIDEBAR_TYPE_ICONS } from '@components/Sidebar/sidebarTheme';

export interface ConditionEditorHeaderProps {
  titleValue: string;
  setTitleValue: (value: string) => void;
  isEditingTitle: boolean;
  setIsEditingTitle: (value: boolean) => void;
  headerHover: boolean;
  setHeaderHover: (hover: boolean) => void;
  titleInputPx: number;
  titleInputRef: React.RefObject<HTMLInputElement>;
  label?: string;
  onRename?: (next: string) => void;
  onClose: () => void;
}

export function ConditionEditorHeader({
  titleValue,
  setTitleValue,
  isEditingTitle,
  setIsEditingTitle,
  headerHover,
  setHeaderHover,
  titleInputPx,
  titleInputRef,
  label,
  onRename,
  onClose,
}: ConditionEditorHeaderProps) {
  const ConditionIcon = SIDEBAR_ICON_COMPONENTS[SIDEBAR_TYPE_ICONS.conditions];

  return (
    <div
      onMouseEnter={() => setHeaderHover(true)}
      onMouseLeave={() => setHeaderHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        border: 'none',
        background: '#f59e0b',
        margin: '-12px -12px 6px -12px',
        borderTopLeftRadius: 6,
        borderTopRightRadius: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {!isEditingTitle ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {ConditionIcon ? <ConditionIcon className="w-4 h-4" style={{ color: '#0b1220' }} /> : null}
            <span style={{ fontWeight: 700, color: '#0b1220' }}>{titleValue}</span>
            <button
              title="Edit title"
              onClick={() => setIsEditingTitle(true)}
              style={{ color: '#0b1220', visibility: headerHover ? 'visible' : 'hidden' }}
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              ref={titleInputRef}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setIsEditingTitle(false);
                  onRename?.(titleValue.trim() || 'Condition');
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsEditingTitle(false);
                  setTitleValue(label || 'Condition');
                }
              }}
              style={{
                width: titleInputPx,
                padding: '4px 6px',
                border: '1px solid #0b1220',
                borderRadius: 6,
                background: 'transparent',
                color: '#0b1220',
              }}
            />
            <button
              title="Confirm"
              onClick={() => {
                setIsEditingTitle(false);
                onRename?.(titleValue.trim() || 'Condition');
              }}
              style={{ color: '#22c55e' }}
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              title="Cancel"
              onClick={() => {
                setIsEditingTitle(false);
                setTitleValue(label || 'Condition');
              }}
              style={{ color: '#ef4444' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      <button
        title="Close"
        onClick={onClose}
        style={{ color: '#0b1220', cursor: 'pointer' }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
