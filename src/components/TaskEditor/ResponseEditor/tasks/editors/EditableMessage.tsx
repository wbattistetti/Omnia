/**
 * Leaf editor for translation-backed message text (parameterId "text", "smsText", etc.).
 * No translation or task logic — parent supplies value and persistence.
 */

import React, { useRef } from 'react';
import { EditableText } from '@components/common/EditableText';

export type EditableMessageProps = {
  value: string;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onCommit: (value: string) => void;
  onAbort: () => void;
  placeholder?: string;
};

export function EditableMessage({
  value,
  editing,
  onEditingChange,
  onCommit,
  onAbort,
  placeholder = 'Scrivi un testo qui...',
}: EditableMessageProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSave = (newValue: string) => {
    onEditingChange(false);
    try {
      inputRef.current?.blur();
    } catch {
      /* ignore */
    }
    onCommit(newValue);
  };

  const handleCancel = () => {
    onEditingChange(false);
    onAbort();
  };

  const handleEdit = () => {
    onEditingChange(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (!editing) return;
    const clickedOnButton = e.relatedTarget && (e.relatedTarget as HTMLElement).tagName === 'BUTTON';
    if (clickedOnButton) return;

    const trimmedValue = e.target.value?.trim() || '';
    const trimmedText = value?.trim() || '';
    if (trimmedText.length === 0 && trimmedValue.length === 0) {
      onEditingChange(false);
      return;
    }
    onEditingChange(false);
    if (trimmedValue.length > 0) {
      onCommit(trimmedValue);
    }
  };

  return (
    <EditableText
      value={value}
      editing={editing}
      onSave={handleSave}
      onCancel={handleCancel}
      onStartEditing={handleEdit}
      onBlur={handleBlur}
      inputRef={inputRef}
      placeholder={placeholder}
      displayMode="text"
      showActionButtons
      expectedLanguage="it"
      showLanguageWarning
      enableVoice
      multiline
      style={{ marginRight: 10 }}
    />
  );
}
