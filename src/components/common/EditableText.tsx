// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X } from 'lucide-react';
import { VoiceTextbox } from './VoiceTextbox';

/**
 * Language detection utility
 * Detects if text contains words from a different language than expected
 */
function detectLanguage(text: string): 'it' | 'en' | 'pt' {
  const textLower = text.toLowerCase();
  // Italian keywords
  if (/\b(chiedi|richiedi|domanda|acquisisci|raccogli|invita|dati|nome|cognome|indirizzo|telefono|email|nascita|paziente|cliente|scadenza|perfavore|prego|grazie|salve|buongiorno|buonasera)\b/.test(textLower)) {
    return 'it';
  }
  // Portuguese keywords
  if (/\b(pedir|solicitar|pergunta|obter|coletar|dados|nome|sobrenome|endereco|telefone|nascimento|paciente|cliente|validade|porfavor|obrigado|ola|bomdia|boanoite)\b/.test(textLower)) {
    return 'pt';
  }
  // English keywords
  if (/\b(ask|request|question|get|collect|data|name|surname|address|phone|email|birth|patient|client|expiry|please|thank|hello|goodmorning|goodevening)\b/.test(textLower)) {
    return 'en';
  }
  // Default: if no clear match, assume Italian (most common in this project)
  return 'it';
}

export interface EditableTextProps {
  // Core props
  value: string;
  editing: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
  onStartEditing?: () => void;

  // Display mode
  displayMode?: 'text' | 'placeholder'; // How to display when not editing

  // Action buttons
  showActionButtons?: boolean; // Check/X buttons (default: true)

  // Language check
  expectedLanguage?: 'it' | 'en' | 'pt'; // Expected language (default: 'it')
  showLanguageWarning?: boolean; // Show warning if language differs (default: true)

  // Voice
  enableVoice?: boolean; // Use VoiceTextbox (default: true)
  micSize?: number; // Microphone icon size (default: 12)
  micBackground?: string; // Microphone background color (default: 'transparent')

  // Input type
  multiline?: boolean; // true = textarea, false = input (only if !enableVoice)

  // Styling
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;

  // Validation
  validation?: (value: string) => { isValid: boolean; errors?: string[]; warnings?: string[] };

  // Callbacks
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;

  // Ref forwarding
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}

/**
 * Universal text editing component with voice input, validation, and language checking.
 *
 * Features:
 * - Voice input enabled by default (long press to dictate)
 * - Check/X buttons for save/cancel
 * - ESC key to cancel
 * - Language detection and warning
 * - Validation support
 * - Works in both editing and display modes
 */
export const EditableText = React.forwardRef<HTMLTextAreaElement, EditableTextProps>(({
  value,
  editing,
  onSave,
  onCancel,
  onStartEditing,
  displayMode = 'text',
  showActionButtons = true,
  expectedLanguage = 'it',
  showLanguageWarning = true,
  enableVoice = true,
  micSize = 12,
  micBackground = 'transparent',
  multiline = false,
  placeholder = 'Scrivi un testo qui...',
  style,
  className,
  validation,
  onBlur,
  onKeyDown,
  inputRef: externalInputRef,
}, forwardedRef) => {
  const internalInputRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = (forwardedRef as React.RefObject<HTMLTextAreaElement>) || externalInputRef || internalInputRef;
  const [editValue, setEditValue] = useState(value);
  const [initialValue, setInitialValue] = useState<string>(value); // Track initial value when editing starts
  const [languageWarning, setLanguageWarning] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; errors?: string[]; warnings?: string[] } | null>(null);
  const lastEnterTimeRef = useRef<number>(0);
  const ENTER_DOUBLE_CLICK_THRESHOLD = 300; // ms between two Enters to consider it a double Enter

  // When entering editing mode, capture the initial value
  useEffect(() => {
    if (editing) {
      setInitialValue(value);
      setEditValue(value);
    }
  }, [editing, value]);

  // Sync editValue when value changes externally (but not while editing)
  useEffect(() => {
    if (!editing) {
      setEditValue(value);
      setInitialValue(value);
    }
  }, [value, editing]);

  // Check if value has changed from initial
  const hasChanged = editing && editValue.trim() !== initialValue.trim();

  // Language detection
  useEffect(() => {
    if (editing && showLanguageWarning && editValue.trim().length > 0) {
      const detected = detectLanguage(editValue);
      if (detected !== expectedLanguage) {
        const langNames: Record<string, string> = {
          'it': 'Italiano',
          'en': 'Inglese',
          'pt': 'Portoghese',
        };
        setLanguageWarning(
          `⚠️ Lingua rilevata: ${langNames[detected] || detected.toUpperCase()} (attesa: ${langNames[expectedLanguage] || expectedLanguage.toUpperCase()})`
        );
      } else {
        setLanguageWarning(null);
      }
    } else {
      setLanguageWarning(null);
    }
  }, [editValue, editing, expectedLanguage, showLanguageWarning]);

  // Validation
  useEffect(() => {
    if (editing && validation && editValue.trim().length > 0) {
      const result = validation(editValue.trim());
      setValidationResult(result);
    } else {
      setValidationResult(null);
    }
  }, [editValue, editing, validation]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditValue(e.target.value);
  }, []);

  // Helper: Save value if changed and optionally close editing
  const saveAndClose = useCallback((shouldClose: boolean = true) => {
    const trimmed = editValue.trim();
    const trimmedInitial = initialValue.trim();

    // Only save if changed
    if (trimmed !== trimmedInitial) {
      if (validation) {
        const result = validation(trimmed);
        if (result.isValid) {
          onSave(trimmed);
        }
      } else {
        onSave(trimmed);
      }
    }

    // Always close if requested (even if unchanged or validation failed)
    if (shouldClose) {
      onCancel();
    }
  }, [editValue, initialValue, validation, onSave, onCancel]);

  // Helper: Insert newline at cursor position
  const insertNewline = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = editValue.substring(0, start) + '\n' + editValue.substring(end);
    setEditValue(newValue);

    // Reposition cursor after newline
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 1;
    }, 0);
  }, [editValue]);

  // Helper: Handle multiline Enter (single = newline, double = close)
  const handleMultilineEnter = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const now = Date.now();
    const timeSinceLastEnter = now - lastEnterTimeRef.current;

    // If double Enter fast (within 300ms), close editing
    if (timeSinceLastEnter < ENTER_DOUBLE_CLICK_THRESHOLD) {
      saveAndClose(true);
    } else {
      // First Enter: go to new line
      insertNewline(e);
    }

    lastEnterTimeRef.current = now;
  }, [saveAndClose, insertNewline]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Call external onKeyDown if provided
    if (onKeyDown) {
      onKeyDown(e);
    }

    // Handle Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      if (!multiline) {
        // multiline = false: single Enter closes editing
        e.preventDefault();
        e.stopPropagation();
        saveAndClose(true);
      } else {
        // multiline = true: single Enter goes to new line, double Enter fast closes
        handleMultilineEnter(e);
      }
    }

    // Handle Escape (cancel)
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  }, [onKeyDown, multiline, saveAndClose, handleMultilineEnter, onCancel]);

  const handleSave = useCallback(() => {
    // Check button: ALWAYS close editing (even if unchanged)
    saveAndClose(true);
  }, [saveAndClose]);

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    // Don't blur if clicking on action buttons
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (relatedTarget && (relatedTarget.tagName === 'BUTTON' || relatedTarget.closest('button'))) {
      return;
    }

    if (onBlur) {
      onBlur(e);
    }
  }, [onBlur]);

  // Display mode (not editing)
  if (!editing) {
    if (displayMode === 'text' && value) {
      return (
        <span
          style={{ color: '#fff', fontWeight: 500, cursor: onStartEditing ? 'pointer' : 'default' }}
          onClick={onStartEditing}
        >
          {value}
        </span>
      );
    }
    return (
      <span
        style={{ color: '#94a3b8', fontStyle: 'italic', cursor: onStartEditing ? 'pointer' : 'default' }}
        onClick={onStartEditing}
      >
        {placeholder}
      </span>
    );
  }

  // Editing mode
  const hasErrors = validationResult && validationResult.errors && validationResult.errors.length > 0;
  const hasWarnings = validationResult && validationResult.warnings && validationResult.warnings.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          {enableVoice ? (
            <VoiceTextbox
              ref={inputRef}
              value={editValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder={placeholder}
              rows={multiline ? undefined : 1}
              className={className}
              micSize={micSize}
              micBackground={micBackground}
              style={{
                fontWeight: 500,
                padding: '6px 10px',
                border: hasErrors ? '1px solid #ef4444' : '0.5px solid #bbb',
                borderRadius: 6,
                outline: 'none',
                boxShadow: 'none',
                minWidth: 80,
                width: '100%',
                boxSizing: 'border-box',
                background: '#fff',
                color: '#111',
                resize: multiline ? 'vertical' : 'none',
                overflowY: 'auto',
                overflowX: 'hidden',
                ...style,
              }}
            />
          ) : (
            <textarea
              ref={inputRef}
              value={editValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder={placeholder}
              rows={multiline ? undefined : 1}
              className={className}
              style={{
                fontWeight: 500,
                padding: '6px 10px',
                border: hasErrors ? '1px solid #ef4444' : '0.5px solid #bbb',
                borderRadius: 6,
                outline: 'none',
                boxShadow: 'none',
                minWidth: 80,
                width: '100%',
                boxSizing: 'border-box',
                background: '#fff',
                color: '#111',
                resize: multiline ? 'vertical' : 'none',
                overflowY: 'auto',
                overflowX: 'hidden',
                ...style,
              }}
            />
          )}

          {/* Language warning */}
          {languageWarning && (
            <div style={{
              position: 'absolute',
              bottom: '-20px',
              left: 0,
              fontSize: '11px',
              color: '#f59e0b',
              backgroundColor: '#fef3c7',
              padding: '2px 6px',
              borderRadius: '4px',
              zIndex: 1000,
              whiteSpace: 'nowrap',
            }}>
              {languageWarning}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {showActionButtons && (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
            {/* Show Check button only if value has changed */}
            {hasChanged && (
              <button
                onClick={handleSave}
                disabled={hasErrors}
                style={{
                  background: 'none',
                  border: 'none',
                  color: hasErrors ? '#9ca3af' : '#22c55e',
                  cursor: hasErrors ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                  opacity: hasErrors ? 0.5 : 1,
                }}
                title="Conferma (Enter)"
                aria-label="Conferma modifica"
              >
                <Check size={18} />
              </button>
            )}
            <button
              onClick={handleCancel}
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
              title="Annulla (ESC)"
              aria-label="Annulla modifica"
            >
              <X size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Validation errors */}
      {hasErrors && (
        <div style={{
          fontSize: '12px',
          color: '#ef4444',
          padding: '4px 8px',
          backgroundColor: '#fee2e2',
          borderRadius: '4px',
        }}>
          {validationResult.errors?.map((error, idx) => (
            <div key={idx}>{error}</div>
          ))}
        </div>
      )}

      {/* Validation warnings */}
      {hasWarnings && !hasErrors && (
        <div style={{
          fontSize: '12px',
          color: '#f59e0b',
          padding: '4px 8px',
          backgroundColor: '#fef3c7',
          borderRadius: '4px',
        }}>
          {validationResult.warnings?.map((warning, idx) => (
            <div key={idx}>{warning}</div>
          ))}
        </div>
      )}
    </div>
  );
});

EditableText.displayName = 'EditableText';
