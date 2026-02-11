import React, { useRef, useCallback, forwardRef, useEffect, useMemo } from 'react';
import { Mic } from 'lucide-react';
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition';

interface VoiceInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  autoStartWhenEmpty?: boolean;
}

/**
 * Universal input component with speech recognition via long press.
 *
 * Features:
 * - Click briefly (< 300ms) → normal focus for manual typing
 * - Long press (> 300ms) → activates voice dictation
 * - Microphone icon turns green and pulses when listening
 * - Text is inserted in real-time
 * - Release click → stops dictation
 * - Uses browser language automatically
 * - Single-line input (no autosize)
 */
export const VoiceInput = forwardRef<HTMLInputElement, VoiceInputProps>(({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
  style,
  autoStartWhenEmpty = false,
  ...rest
}, forwardedRef) => {
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = (forwardedRef as React.RefObject<HTMLInputElement>) || internalRef;

  // Use voice recognition hook
  const voiceRecognition = useVoiceRecognition({
    value,
    onChange: (e) => {
      // Convert to proper ChangeEvent format
      const syntheticEvent = {
        ...e,
        target: e.target as HTMLInputElement,
        currentTarget: e.currentTarget as HTMLInputElement,
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    },
    autoStartWhenEmpty,
    elementRef: inputRef,
  });

  // Combine internal handlers with external ones from props
  const combinedMouseDown = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    voiceRecognition.handleMouseDown(e);
    if (rest.onMouseDown) {
      rest.onMouseDown(e);
    }
  }, [voiceRecognition, rest.onMouseDown]);

  const combinedMouseUp = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    voiceRecognition.handleMouseUp(e);
    if (rest.onMouseUp) {
      rest.onMouseUp(e);
    }
  }, [voiceRecognition, rest.onMouseUp]);

  const combinedMouseLeave = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    voiceRecognition.handleMouseLeave();
    if (rest.onMouseLeave) {
      rest.onMouseLeave(e);
    }
  }, [voiceRecognition, rest.onMouseLeave]);

  const combinedPointerDown = useCallback((e: React.PointerEvent<HTMLInputElement>) => {
    voiceRecognition.handlePointerDown(e);
    if (rest.onPointerDown) {
      rest.onPointerDown(e);
    }
  }, [voiceRecognition, rest.onPointerDown]);

  const combinedPointerUp = useCallback((e: React.PointerEvent<HTMLInputElement>) => {
    voiceRecognition.handlePointerUp(e);
    if (rest.onPointerUp) {
      rest.onPointerUp(e);
    }
  }, [voiceRecognition, rest.onPointerUp]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    voiceRecognition.handleKeyDown(e);
    if (onKeyDown) {
      onKeyDown(e);
    }
  }, [voiceRecognition, onKeyDown]);

  // Handle focus
  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    voiceRecognition.handleFocus(e);
    if (rest.onFocus) {
      rest.onFocus(e);
    }
  }, [voiceRecognition, rest.onFocus]);

  // Handle change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    voiceRecognition.handleChange(e);
    onChange(e);
  }, [voiceRecognition, onChange]);

  // Extract handlers from rest to avoid passing them twice
  const { onMouseDown, onMouseUp, onMouseLeave, onPointerDown, onPointerUp, onFocus, ...restWithoutHandlers } = rest;

  const isListening = voiceRecognition.isListening;
  const isLongPressing = voiceRecognition.isLongPressing;
  const isSupported = voiceRecognition.isSupported;

  // Build input style: extract padding if present, then apply voice-specific styles
  const inputStyle = useMemo(() => {
    const baseStyle = { ...style };

    // Remove border shorthand if present to avoid conflicts with individual border properties
    const { border, ...styleWithoutBorder } = baseStyle;

    return {
      ...styleWithoutBorder,
      // Force paddingRight for microphone icon space (always, so icon doesn't shift layout)
      paddingRight: isSupported ? '28px' : (baseStyle.paddingRight || undefined),
      // When voice is active, override border with green; otherwise preserve original
      borderColor: (isLongPressing || isListening) ? '#22c55e' : (baseStyle.borderColor || undefined),
      borderWidth: (isLongPressing || isListening) ? '2px' : (baseStyle.borderWidth || undefined),
      borderStyle: (isLongPressing || isListening) ? 'solid' : (baseStyle.borderStyle || undefined),
      transition: 'border-color 0.2s ease, border-width 0.2s ease',
      cursor: isLongPressing ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2322c55e\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z\'/%3E%3Cpath d=\'M19 10v2a7 7 0 0 1-14 0v-2\'/%3E%3Cline x1=\'12\' y1=\'19\' x2=\'12\' y2=\'23\'/%3E%3Cline x1=\'8\' y1=\'23\' x2=\'16\' y2=\'23\'/%3E%3C/svg%3E") 12 12, auto' : isListening ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'2\' fill=\'%2322c55e\' opacity=\'0.8\'%3E%3Canimate attributeName=\'r\' values=\'2;6;2\' dur=\'1s\' repeatCount=\'indefinite\'/%3E%3Canimate attributeName=\'opacity\' values=\'0.8;0.2;0.8\' dur=\'1s\' repeatCount=\'indefinite\'/%3E%3C/circle%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'4\' fill=\'%2322c55e\' opacity=\'0.4\'%3E%3Canimate attributeName=\'r\' values=\'4;8;4\' dur=\'1.5s\' repeatCount=\'indefinite\'/%3E%3Canimate attributeName=\'opacity\' values=\'0.4;0;0.4\' dur=\'1.5s\' repeatCount=\'indefinite\'/%3E%3C/circle%3E%3C/svg%3E") 12 12, auto' : (baseStyle.cursor || undefined),
    };
  }, [style, isSupported, isLongPressing, isListening]);

  // Extract width and minWidth from style to apply to wrapper
  // This ensures the wrapper has the same width as the input, so the icon stays inside
  const wrapperStyle = useMemo(() => {
    const baseStyle = { ...style };
    return {
      position: 'relative' as const,
      display: 'inline-block',
      width: baseStyle.width || '100%',
      minWidth: baseStyle.minWidth || undefined,
      overflow: 'visible' as const,
    };
  }, [style]);

  return (
    <div style={wrapperStyle}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onMouseDown={combinedMouseDown}
        onMouseUp={combinedMouseUp}
        onMouseLeave={combinedMouseLeave}
        onPointerDown={combinedPointerDown}
        onPointerUp={combinedPointerUp}
        placeholder={placeholder}
        className={`${className || ''} ${isLongPressing || isListening ? 'voice-input-active' : ''} ${isListening ? 'voice-input-listening' : ''}`.trim()}
        style={inputStyle}
        {...restWithoutHandlers}
      />

      {/* Microphone icon */}
      {isSupported && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            right: '4px',
            transform: 'translateY(-50%)',
            zIndex: 10,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '4px',
            padding: '2px',
          }}
        >
          <Mic
            size={16}
            color={isListening ? '#22c55e' : '#4b5563'}
            style={{
              animation: isListening ? 'speechMicPulse 1.5s ease-in-out infinite' : 'none',
            }}
          />
        </div>
      )}
    </div>
  );
});

VoiceInput.displayName = 'VoiceInput';
