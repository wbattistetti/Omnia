// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useEffect, useRef, useState } from 'react';
import type { ValidationResult, SynonymSuggestion } from '../../types/slotEditorTypes';
import {
  editingInputStyle,
  validationErrorStyle,
  validationWarningStyle,
  suggestionStyle,
  suggestionItemStyle,
  suggestionItemHoverStyle,
  type Theme,
} from './styles';

interface EditingNodeProps {
  initialValue: string;
  placeholder: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  autoFocus?: boolean;
  validation?: ValidationResult;
  suggestions?: SynonymSuggestion[];
  theme: Theme;
  onValidate?: (value: string) => ValidationResult;
}

/**
 * Reusable inline editing input component
 * Single Responsibility: Input field with validation and suggestions
 */
export function EditingNode({
  initialValue,
  placeholder,
  onSave,
  onCancel,
  autoFocus = true,
  validation: initialValidation,
  suggestions,
  theme,
  onValidate,
}: EditingNodeProps) {
  const [value, setValue] = useState(initialValue);
  const [validation, setValidation] = useState<ValidationResult | undefined>(initialValidation);
  const [hoveredSuggestion, setHoveredSuggestion] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    // Validate in real-time if validator provided
    if (onValidate) {
      const result = onValidate(newValue);
      setValidation(result);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Re-validate with current value before saving
      if (onValidate) {
        const result = onValidate(value.trim());
        setValidation(result);
        if (result.isValid) {
          onSave(value.trim());
        }
      } else if (validation?.isValid !== false) {
        onSave(value.trim());
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setValue(suggestion);
    inputRef.current?.focus();
  };

  const hasErrors = validation && validation.errors.length > 0;
  const hasWarnings = validation && validation.warnings.length > 0;
  const hasSuggestions = suggestions && suggestions.length > 0;

  return (
    <div style={{ width: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={editingInputStyle(theme)}
      />

      {hasErrors && (
        <div style={validationErrorStyle(theme)}>
          {validation.errors.map((error, idx) => (
            <div key={idx}>{error}</div>
          ))}
        </div>
      )}

      {hasWarnings && !hasErrors && (
        <div style={validationWarningStyle(theme)}>
          {validation.warnings.map((warning, idx) => (
            <div key={idx}>{warning}</div>
          ))}
        </div>
      )}

      {hasSuggestions && !hasErrors && (
        <div style={suggestionStyle(theme)}>
          Suggestions:{' '}
          {suggestions.map((suggestion, idx) => (
            <span
              key={idx}
              style={{
                ...suggestionItemStyle(theme),
                ...(hoveredSuggestion === suggestion.value ? suggestionItemHoverStyle(theme) : {}),
              }}
              onMouseEnter={() => setHoveredSuggestion(suggestion.value)}
              onMouseLeave={() => setHoveredSuggestion(null)}
              onClick={() => handleSuggestionClick(suggestion.value)}
              title={`Confidence: ${Math.round(suggestion.confidence * 100)}%`}
            >
              {suggestion.value}
            </span>
          ))}
        </div>
      )}

      {validation?.suggestions && validation.suggestions.length > 0 && !hasErrors && (
        <div style={suggestionStyle(theme)}>
          Suggested format:{' '}
          {validation.suggestions.map((suggestion, idx) => (
            <span
              key={idx}
              style={{
                ...suggestionItemStyle(theme),
                ...(hoveredSuggestion === suggestion ? suggestionItemHoverStyle(theme) : {}),
              }}
              onMouseEnter={() => setHoveredSuggestion(suggestion)}
              onMouseLeave={() => setHoveredSuggestion(null)}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
