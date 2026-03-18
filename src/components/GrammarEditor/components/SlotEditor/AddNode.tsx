// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Box, Pencil, MessageSquare } from 'lucide-react';
import { EditableText } from '../../../common/EditableText';
import { addNodeStyle, iconStyle, editingInputStyle, type Theme } from './styles';
import type { ValidationResult, SynonymSuggestion } from '../../types/slotEditorTypes';

type IconType = 'arrow' | 'box' | 'pencil' | 'message';

interface AddNodeProps {
  placeholder: string;
  onAdd: (name: string) => void;
  level: number;
  theme: Theme;
  iconType?: IconType;
  validation?: (value: string) => ValidationResult;
  suggestions?: (value: string) => SynonymSuggestion[];
  autoEditKey?: string;
  currentAutoEditKey?: string | null;
  onAutoEditComplete?: () => void;
}

/**
 * Reusable "..." add node component
 * Single Responsibility: Add new items to tree
 */
export function AddNode({
  placeholder,
  onAdd,
  level,
  theme,
  iconType = 'pencil',
  validation,
  suggestions,
  autoEditKey,
  currentAutoEditKey,
  onAutoEditComplete,
}: AddNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [validationResult, setValidationResult] = useState<ValidationResult | undefined>();
  const [suggestionList, setSuggestionList] = useState<SynonymSuggestion[]>([]);
  const hasAutoEditedRef = useRef(false);

  // Event-driven auto-edit: when currentAutoEditKey matches autoEditKey, enter editing mode
  // Clean algorithm: only one AddNode in editing at a time by construction
  useEffect(() => {
    // If another AddNode is being auto-edited and it's not this one, exit editing
    if (currentAutoEditKey && currentAutoEditKey !== autoEditKey && isEditing) {
      setIsEditing(false);
      setEditValue('');
      setValidationResult(undefined);
      setSuggestionList([]);
      hasAutoEditedRef.current = false;
      return;
    }

    // Enter editing when this AddNode's key matches
    if (autoEditKey && currentAutoEditKey === autoEditKey && !isEditing && !hasAutoEditedRef.current) {
      setIsEditing(true);
      setEditValue('');
      setValidationResult(undefined);
      setSuggestionList([]);
      hasAutoEditedRef.current = true;

      // Notify parent that auto-edit has been triggered
      if (onAutoEditComplete) {
        setTimeout(() => {
          onAutoEditComplete();
        }, 0);
      }
    }

    // Reset flag when autoEditKey changes
    if (currentAutoEditKey !== autoEditKey) {
      hasAutoEditedRef.current = false;
    }
  }, [autoEditKey, currentAutoEditKey, isEditing, onAutoEditComplete]);

  const handleClick = () => {
    // Notify parent to close all other AddNodes before entering editing (clean algorithm)
    if (onAutoEditComplete) {
      onAutoEditComplete(); // This will reset autoEditKey, closing other AddNodes
    }
    setIsEditing(true);
    setEditValue('');
    setValidationResult(undefined);
    setSuggestionList([]);
  };

  const handleSave = (value: string) => {
    console.log('[AddNode] 🔍 handleSave CALLED', {
      value,
      valueTrimmed: value.trim(),
      hasValidation: !!validation,
      onAdd: !!onAdd,
    });

    if (!value.trim()) {
      console.log('[AddNode] ⚠️ Empty value, canceling save');
      setIsEditing(false);
      hasAutoEditedRef.current = false;
      return;
    }

    // Validate with current value
    if (validation) {
      const result = validation(value.trim());
      setValidationResult(result);
      console.log('[AddNode] 🔍 Validation result', {
        isValid: result.isValid,
        error: result.error,
      });
      if (!result.isValid) {
        console.log('[AddNode] ❌ Validation failed, not saving');
        return; // Don't save if invalid
      }
    }

    console.log('[AddNode] ✅ Calling onSave', {
      value: value.trim(),
    });

    // Get suggestions if provider available
    if (suggestions) {
      const suggs = suggestions(value);
      setSuggestionList(suggs);
    }

    // Always finalize editing before saving (clean algorithm)
    setIsEditing(false);
    setEditValue('');
    setValidationResult(undefined);
    setSuggestionList([]);
    hasAutoEditedRef.current = false;

    // Save after finalizing editing
    onAdd(value.trim());
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue('');
    setValidationResult(undefined);
    setSuggestionList([]);
    hasAutoEditedRef.current = false;
    // Notify parent that editing was cancelled
    if (onAutoEditComplete) {
      onAutoEditComplete();
    }
  };

  // Get icon component and color (gray for AddNode)
  const getIcon = () => {
    const grayColor = theme.placeholder;
    const iconSize = 14;

    switch (iconType) {
      case 'arrow':
        return <ArrowRight size={iconSize} color={grayColor} />;
      case 'box':
        return <Box size={iconSize} color={grayColor} />;
      case 'pencil':
        return <Pencil size={iconSize} color={grayColor} />;
      case 'message':
        return <MessageSquare size={iconSize} color={grayColor} />;
      default:
        return <Pencil size={iconSize} color={grayColor} />;
    }
  };

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus when entering editing mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isEditing]);

  if (isEditing) {
    // Use key to force reset when entering auto-edit mode
    const editingKey = autoEditKey && currentAutoEditKey === autoEditKey
      ? `auto-edit-${autoEditKey}-${Date.now()}`
      : 'manual-edit';

    // Convert ValidationResult to EditableText validation format
    const validationForEditableText = validation
      ? (value: string) => {
          const result = validation(value);
          return {
            isValid: result.isValid,
            errors: result.errors,
            warnings: result.warnings,
          };
        }
      : undefined;

    return (
      <div style={addNodeStyle(theme, level)}>
        <EditableText
          key={editingKey}
          value=""
          editing={true}
          onSave={handleSave}
          onCancel={handleCancel}
          placeholder={placeholder}
          showActionButtons={true}
          expectedLanguage="it"
          showLanguageWarning={true}
          enableVoice={true}
          multiline={false}
          validation={validationForEditableText}
          inputRef={inputRef}
          style={{
            ...editingInputStyle(theme),
            width: '100%',
          }}
        />
      </div>
    );
  }

  return (
    <div style={addNodeStyle(theme, level)} onClick={handleClick}>
      <div style={iconStyle}>
        {getIcon()}
      </div>
      <span style={{ color: theme.placeholder, fontStyle: 'italic' }}>...</span>
    </div>
  );
}
