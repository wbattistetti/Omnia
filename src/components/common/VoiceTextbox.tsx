import React, { useEffect, useRef, useCallback, forwardRef } from 'react';
import { Mic } from 'lucide-react';
import SmartTooltip, { ToolbarButton } from '../SmartTooltip';
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition';

export interface VoiceTextboxPayoffConfig {
  message?: string;
  delay?: number;
  persistent?: boolean;
  storageKey?: string;
  foreColor?: string;
  backColor?: string;
  opacity?: number;
  position?: 'top' | 'bottom';
  align?: 'left' | 'right' | 'center';
  toolbar?: ToolbarButton[];
  showQuestionMark?: boolean;
  onDismiss?: () => void;
  onShow?: () => void;
}

interface VoiceTextboxProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  payoffConfig?: VoiceTextboxPayoffConfig;
  autoStartWhenEmpty?: boolean;
}

/**
 * Universal textarea component with speech recognition via long press.
 *
 * Features:
 * - Click briefly (< 300ms) → normal focus for manual typing
 * - Long press (> 300ms) → activates voice dictation
 * - Microphone icon turns green and pulses when listening
 * - Text is inserted in real-time
 * - Release click → stops dictation
 * - Uses browser language automatically
 */
export const VoiceTextbox = forwardRef<HTMLTextAreaElement, VoiceTextboxProps>(({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
  style,
  payoffConfig,
  autoStartWhenEmpty = false,
  ...rest
}, forwardedRef) => {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = (forwardedRef as React.RefObject<HTMLTextAreaElement>) || internalRef;

  // Use voice recognition hook
  const voiceRecognition = useVoiceRecognition({
    value,
    onChange: (e) => {
      // Convert to proper ChangeEvent format
      const syntheticEvent = {
        ...e,
        target: e.target as HTMLTextAreaElement,
        currentTarget: e.currentTarget as HTMLTextAreaElement,
      } as React.ChangeEvent<HTMLTextAreaElement>;
      onChange(syntheticEvent);
    },
    autoStartWhenEmpty,
    elementRef: textareaRef,
  });

  // Combine internal handlers with external ones from props
  const combinedMouseDown = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    voiceRecognition.handleMouseDown(e);
    if (rest.onMouseDown) {
      rest.onMouseDown(e);
    }
  }, [voiceRecognition, rest.onMouseDown]);

  const combinedMouseUp = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    voiceRecognition.handleMouseUp(e);

    // If dictation was active, simulate Enter to finalize (original behavior)
    if (voiceRecognition.isListening) {
      setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea && onKeyDown) {
          const enterEvent = {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            shiftKey: false,
            altKey: false,
            ctrlKey: false,
            metaKey: false,
            preventDefault: () => {},
            stopPropagation: () => {},
            currentTarget: textarea,
            target: textarea,
            bubbles: true,
            cancelable: true,
            nativeEvent: {} as any,
            isDefaultPrevented: () => false,
            isPropagationStopped: () => false,
            persist: () => {},
            timeStamp: Date.now(),
            type: 'keydown',
          } as React.KeyboardEvent<HTMLTextAreaElement>;
          onKeyDown(enterEvent);
        }
      }, 100);
    }

    if (rest.onMouseUp) {
      rest.onMouseUp(e);
    }
  }, [voiceRecognition, onKeyDown, rest.onMouseUp]);

  const combinedMouseLeave = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    voiceRecognition.handleMouseLeave();
    if (rest.onMouseLeave) {
      rest.onMouseLeave(e);
    }
  }, [voiceRecognition, rest.onMouseLeave]);

  const combinedPointerDown = useCallback((e: React.PointerEvent<HTMLTextAreaElement>) => {
    voiceRecognition.handlePointerDown(e);
    if (rest.onPointerDown) {
      rest.onPointerDown(e);
    }
  }, [voiceRecognition, rest.onPointerDown]);

  const combinedPointerUp = useCallback((e: React.PointerEvent<HTMLTextAreaElement>) => {
    voiceRecognition.handlePointerUp(e);
    if (rest.onPointerUp) {
      rest.onPointerUp(e);
    }
  }, [voiceRecognition, rest.onPointerUp]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    voiceRecognition.handleKeyDown(e);
    if (onKeyDown) {
      onKeyDown(e);
    }
  }, [voiceRecognition, onKeyDown]);

  // Handle focus
  const handleFocus = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    voiceRecognition.handleFocus(e);
    if (rest.onFocus) {
      rest.onFocus(e);
    }
  }, [voiceRecognition, rest.onFocus]);

  // Handle change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    voiceRecognition.handleChange(e);
    onChange(e);
  }, [voiceRecognition, onChange]);

  // Extract handlers from rest to avoid passing them twice
  const { onMouseDown, onMouseUp, onMouseLeave, onPointerDown, onPointerUp, onFocus, ...restWithoutHandlers } = rest;

  const isListening = voiceRecognition.isListening;
  const isLongPressing = voiceRecognition.isLongPressing;
  const isSupported = voiceRecognition.isSupported;

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      {/* SmartTooltip wrapper if payoffConfig is provided */}
      {payoffConfig && isSupported ? (
        <SmartTooltip
          text={payoffConfig.message || "Keep the mouse pressed and dictate"}
          showOnMount={true}
          delay={payoffConfig.delay ?? 1000}
          persistent={payoffConfig.persistent ?? false}
          storageKey={payoffConfig.storageKey || 'voice-textbox-payoff-dismissed'}
          foreColor={payoffConfig.foreColor || '#22c55e'}
          backColor={payoffConfig.backColor || '#1f2937'}
          opacity={payoffConfig.opacity ?? 0.95}
          placement={payoffConfig.position || 'top'}
          align={payoffConfig.align || 'left'}
          toolbar={payoffConfig.toolbar || [
            {
              label: 'Got it!',
              onClick: () => {},
              variant: 'primary',
            },
          ]}
          showQuestionMark={payoffConfig.showQuestionMark ?? false}
          onDismiss={payoffConfig.onDismiss}
          onShow={payoffConfig.onShow}
        >
          <textarea
            ref={textareaRef}
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
            className={`${className || ''} ${isLongPressing || isListening ? 'voice-textbox-active' : ''} ${isListening ? 'voice-textbox-listening' : ''}`.trim()}
            style={{
              ...style,
              paddingRight: isSupported ? '24px' : (style?.paddingRight || undefined),
              ...((isLongPressing || isListening) ? {
                borderColor: '#22c55e',
                borderWidth: '2px',
                borderStyle: style?.borderStyle || 'solid',
              } : {}),
              transition: 'border-color 0.2s ease, border-width 0.2s ease',
              cursor: isLongPressing ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2322c55e\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z\'/%3E%3Cpath d=\'M19 10v2a7 7 0 0 1-14 0v-2\'/%3E%3Cline x1=\'12\' y1=\'19\' x2=\'12\' y2=\'23\'/%3E%3Cline x1=\'8\' y1=\'23\' x2=\'16\' y2=\'23\'/%3E%3C/svg%3E") 12 12, auto' : isListening ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'2\' fill=\'%2322c55e\' opacity=\'0.8\'%3E%3Canimate attributeName=\'r\' values=\'2;6;2\' dur=\'1s\' repeatCount=\'indefinite\'/%3E%3Canimate attributeName=\'opacity\' values=\'0.8;0.2;0.8\' dur=\'1s\' repeatCount=\'indefinite\'/%3E%3C/circle%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'4\' fill=\'%2322c55e\' opacity=\'0.4\'%3E%3Canimate attributeName=\'r\' values=\'4;8;4\' dur=\'1.5s\' repeatCount=\'indefinite\'/%3E%3Canimate attributeName=\'opacity\' values=\'0.4;0;0.4\' dur=\'1.5s\' repeatCount=\'indefinite\'/%3E%3C/circle%3E%3C/svg%3E") 12 12, auto' : (style?.cursor || undefined),
            }}
            {...restWithoutHandlers}
          />
        </SmartTooltip>
      ) : (
        <textarea
          ref={textareaRef}
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
          className={`${className || ''} ${isLongPressing || isListening ? 'voice-textbox-active' : ''} ${isListening ? 'voice-textbox-listening' : ''}`.trim()}
          style={{
            ...style,
            paddingRight: isSupported ? '24px' : (style?.paddingRight || undefined),
            ...((isLongPressing || isListening) ? {
              borderColor: '#22c55e',
              borderWidth: '2px',
              borderStyle: style?.borderStyle || 'solid',
            } : {}),
            transition: 'border-color 0.2s ease, border-width 0.2s ease',
            cursor: isLongPressing ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2322c55e\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z\'/%3E%3Cpath d=\'M19 10v2a7 7 0 0 1-14 0v-2\'/%3E%3Cline x1=\'12\' y1=\'19\' x2=\'12\' y2=\'23\'/%3E%3Cline x1=\'8\' y1=\'23\' x2=\'16\' y2=\'23\'/%3E%3C/svg%3E") 12 12, auto' : isListening ? 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'2\' fill=\'%2322c55e\' opacity=\'0.8\'%3E%3Canimate attributeName=\'r\' values=\'2;6;2\' dur=\'1s\' repeatCount=\'indefinite\'/%3E%3Canimate attributeName=\'opacity\' values=\'0.8;0.2;0.8\' dur=\'1s\' repeatCount=\'indefinite\'/%3E%3C/circle%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'4\' fill=\'%2322c55e\' opacity=\'0.4\'%3E%3Canimate attributeName=\'r\' values=\'4;8;4\' dur=\'1.5s\' repeatCount=\'indefinite\'/%3E%3Canimate attributeName=\'opacity\' values=\'0.4;0;0.4\' dur=\'1.5s\' repeatCount=\'indefinite\'/%3E%3C/circle%3E%3C/svg%3E") 12 12, auto' : (style?.cursor || undefined),
          }}
          {...restWithoutHandlers}
        />
      )}

      {/* Microphone icon */}
      {isSupported && (
        <div
          style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            zIndex: 10,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Mic
            size={12}
            color={isListening ? '#22c55e' : '#6b7280'}
            style={{
              animation: isListening ? 'speechMicPulse 1.5s ease-in-out infinite' : 'none',
            }}
          />
        </div>
      )}
    </div>
  );
});

VoiceTextbox.displayName = 'VoiceTextbox';
