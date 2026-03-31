// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Play, Pencil, Trash2 } from 'lucide-react';
import type { TestPhrase } from './TestPhrases';

const ACTION_GAP_PX = 5;

interface TestPhraseListProps {
  phrases: TestPhrase[];
  selectedPhraseId: string | null;
  editingPhraseId: string | null;
  editDraft: string;
  onSelectPhrase: (id: string) => void;
  onTestPhrase: (id: string) => void;
  onBeginEdit: (id: string) => void;
  onEditDraftChange: (value: string) => void;
  onCommitEdit: (id: string) => void;
  onCancelEdit: () => void;
  onRemovePhrase: (id: string) => void;
}

export function TestPhraseList({
  phrases,
  selectedPhraseId,
  editingPhraseId,
  editDraft,
  onSelectPhrase,
  onTestPhrase,
  onBeginEdit,
  onEditDraftChange,
  onCommitEdit,
  onCancelEdit,
  onRemovePhrase,
}: TestPhraseListProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingPhraseId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingPhraseId]);

  const handleRowClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      onSelectPhrase(id);
    },
    [onSelectPhrase]
  );

  return (
    <div style={{ padding: '4px 0' }}>
      {phrases.length === 0 ? (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '14px',
          }}
        >
          No test phrases. Add one above.
        </div>
      ) : (
        phrases.map(phrase => {
          const isSelected = phrase.id === selectedPhraseId;
          const isHovered = hoveredId === phrase.id;
          const isEditing = editingPhraseId === phrase.id;

          const statusColor =
            phrase.status === 'matched'
              ? '#10b981'
              : phrase.status === 'no-match'
                ? '#ef4444'
                : '#6b7280';

          const textColor =
            phrase.status === 'matched'
              ? '#059669'
              : phrase.status === 'no-match'
                ? '#dc2626'
                : '#374151';

          return (
            <div
              key={phrase.id}
              onMouseEnter={() => setHoveredId(phrase.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={e => handleRowClick(e, phrase.id)}
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                padding: '8px 12px',
                borderBottom: '1px solid #f3f4f6',
                gap: 10,
                backgroundColor: isSelected
                  ? '#eff6ff'
                  : phrase.status === 'matched'
                    ? '#f0fdf4'
                    : phrase.status === 'no-match'
                      ? '#fef2f2'
                      : '#fff',
                cursor: 'pointer',
                borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: statusColor,
                  flexShrink: 0,
                  marginTop: 6,
                }}
              />

              <div style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.45 }}>
                {isEditing ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={editDraft}
                    onChange={e => onEditDraftChange(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onCommitEdit(phrase.id);
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        onCancelEdit();
                      }
                    }}
                    onBlur={() => onCommitEdit(phrase.id)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '4px 8px',
                      border: '1px solid #3b82f6',
                      borderRadius: 4,
                      fontSize: 14,
                      color: textColor,
                      fontWeight: phrase.status ? 500 : 400,
                    }}
                  />
                ) : (
                  <span
                    style={{
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      color: textColor,
                      fontWeight: phrase.status ? 500 : 400,
                    }}
                  >
                    {phrase.text}
                    <span
                      style={{
                        marginLeft: ACTION_GAP_PX,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        verticalAlign: 'middle',
                        opacity: isHovered ? 1 : 0,
                        pointerEvents: isHovered ? 'auto' : 'none',
                        transition: 'opacity 0.12s ease-out',
                      }}
                    >
                      <button
                        type="button"
                        title="Edit phrase"
                        onMouseDown={e => e.preventDefault()}
                        onClick={e => {
                          e.stopPropagation();
                          onBeginEdit(phrase.id);
                        }}
                        style={{
                          padding: 2,
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Pencil size={12} color="#374151" />
                      </button>
                      <button
                        type="button"
                        title="Remove phrase"
                        onMouseDown={e => e.preventDefault()}
                        onClick={e => {
                          e.stopPropagation();
                          onRemovePhrase(phrase.id);
                        }}
                        style={{
                          padding: 2,
                          border: '1px solid #fecaca',
                          borderRadius: 4,
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={12} color="#b91c1c" />
                      </button>
                      <button
                        type="button"
                        title="Test this phrase"
                        onMouseDown={e => e.preventDefault()}
                        onClick={e => {
                          e.stopPropagation();
                          onTestPhrase(phrase.id);
                        }}
                        style={{
                          padding: '2px 6px',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        <Play size={12} />
                      </button>
                    </span>
                  </span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
