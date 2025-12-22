import React, { useEffect, useRef, useState, useCallback, forwardRef } from 'react';
import { Mic } from 'lucide-react';
import SmartTooltip, { ToolbarButton } from '../SmartTooltip';

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
  ...rest
}, forwardedRef) => {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = (forwardedRef as React.RefObject<HTMLTextAreaElement>) || internalRef;

  const recognitionRef = useRef<any>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false); // Track when long press is active (before dictation starts)

  // Track long press state
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActiveRef = useRef<boolean>(false);

  // Track recognition session
  const baseTextRef = useRef<string>(''); // Text at start of dictation
  const isListeningRef = useRef<boolean>(false); // Track listening state without causing re-renders
  const onChangeRef = useRef(onChange); // Store onChange in ref to avoid dependency issues
  const valueRef = useRef(value); // Store value in ref to avoid dependency issues
  const lastProcessedIndexRef = useRef<number>(0); // Track last processed result index to avoid duplicates

  // Update refs when values change
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    // Use browser language
    const browserLang = navigator.language || navigator.languages?.[0] || 'en-US';
    recognition.lang = browserLang;

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors on cleanup
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  // Start dictation
  const startDictation = useCallback(() => {
    const textarea = textareaRef.current;
    const recognition = recognitionRef.current;

    if (!textarea || !recognition || isListening) return;

    // Save current text as base and reset processed index
    baseTextRef.current = value || '';
    lastProcessedIndexRef.current = 0; // Reset index to start fresh

    try {
      setIsListening(true);
      recognition.start();
    } catch (err: any) {
      if (!err.message?.includes('already')) {
        // Silent fail
      }
      setIsListening(false);
    }
  }, [value, isListening]);

  // Stop dictation
  const stopDictation = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || !isListening) return;

    try {
      recognition.stop();
    } catch (e) {
      // Ignore errors
    }
    setIsListening(false);
    baseTextRef.current = '';
    lastProcessedIndexRef.current = 0; // Reset index
  }, [isListening]);

  // Handle mouse down - start long press timer
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (!isSupported) {
      return;
    }

    // Stop propagation to prevent canvas click interference
    e.stopPropagation();

    // Clear any existing timeout
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }

    isLongPressActiveRef.current = false;
    setIsLongPressing(false);

    // Start timer for long press (300ms)
    longPressTimeoutRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      setIsLongPressing(true); // Show visual feedback (microphone cursor, green border)
      startDictation();
    }, 300);
  }, [isSupported, startDictation]);

  // Handle mouse up - check if it was a short click or long press release
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    // Stop propagation to prevent canvas click interference
    e.stopPropagation();

    // Clear long press timer if it hasn't fired yet (short click)
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    // If dictation was active, stop it and simulate Enter to finalize
    if (isListening) {
      stopDictation();

      // Wait a bit for the recognition to finalize, then simulate Enter
      setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea && onKeyDown) {
          // Create a synthetic Enter keydown event
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
      }, 100); // Small delay to ensure recognition has finalized
    }

    isLongPressActiveRef.current = false;
    setIsLongPressing(false); // Reset visual feedback
  }, [isListening, stopDictation, onKeyDown]);

  // Handle mouse leave - cancel long press if mouse leaves
  const handleMouseLeave = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    // If dictation was active, stop it
    if (isListening) {
      stopDictation();
    }

    isLongPressActiveRef.current = false;
    setIsLongPressing(false); // Reset visual feedback
  }, [isListening, stopDictation]);

  // Setup recognition event handlers (only once when supported)
  useEffect(() => {
    const textarea = textareaRef.current;
    const recognition = recognitionRef.current;

    if (!textarea || !recognition || !isSupported) return;

    const handleResult = (event: any) => {
      const currentTextarea = textareaRef.current;
      if (!isListeningRef.current || !currentTextarea || document.activeElement !== currentTextarea) {
        return;
      }

      // Check if element is still in DOM
      if (!document.body.contains(currentTextarea)) {
        const recognition = recognitionRef.current;
        if (recognition) {
          try {
            recognition.stop();
          } catch (e) {}
        }
        setIsListening(false);
        return;
      }

      const results = event.results;
      if (!results || results.length === 0) return;

      // Process only NEW final results (from lastProcessedIndex onwards)
      // This prevents duplicates and overwrites when API reorganizes results
      let finalText = baseTextRef.current;
      let processedAnyNew = false;

      for (let i = lastProcessedIndexRef.current; i < results.length; i++) {
        const result = results[i];
        if (result.isFinal && result[0]) {
          const transcript = result[0].transcript;
          // Add space if needed
          if (finalText && !finalText.endsWith(' ') && !transcript.startsWith(' ')) {
            finalText += ' ';
          }
          finalText += transcript;
          processedAnyNew = true;
        }
      }

      // Update last processed index only if we processed new results
      if (processedAnyNew) {
        lastProcessedIndexRef.current = results.length;
        // Update baseTextRef to current finalText so next iteration starts from here
        baseTextRef.current = finalText;
      }

      // Find last interim result for preview
      let lastInterim = '';
      for (let i = results.length - 1; i >= 0; i--) {
        const result = results[i];
        if (!result.isFinal && result[0]) {
          lastInterim = result[0].transcript;
          break;
        }
      }

      // Build display value: current final text + last interim
      let displayValue = finalText;
      if (lastInterim) {
        if (displayValue && !displayValue.endsWith(' ') && !lastInterim.startsWith(' ')) {
          displayValue += ' ';
        }
        displayValue += lastInterim;
      }

      // Update React state
      if (displayValue !== valueRef.current) {
        const syntheticEvent = {
          target: { value: displayValue },
          currentTarget: { value: displayValue },
          type: 'input',
          bubbles: true,
          cancelable: true,
        } as React.ChangeEvent<HTMLTextAreaElement>;

        onChangeRef.current(syntheticEvent);
      }
    };

    const handleError = (event: any) => {
      // Only stop on critical errors, not "no-speech" (which is temporary)
      if (event.error === 'no-speech') {
        return;
      }
      // For other errors (network, service, etc), stop listening
      console.error('🎤 [ERROR]', event.error);
      const recognition = recognitionRef.current;
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {}
      }
      setIsListening(false);
      baseTextRef.current = '';
      lastProcessedIndexRef.current = 0; // Reset index
    };

    const handleEnd = () => {
      setIsListening(false);
      baseTextRef.current = '';
      lastProcessedIndexRef.current = 0; // Reset index
    };

    recognition.onresult = handleResult;
    recognition.onerror = handleError;
    recognition.onend = handleEnd;

    return () => {
      // Cleanup on unmount
      if (isListeningRef.current) {
        try {
          recognition.stop();
        } catch (e) {
          // Ignore errors
        }
      }
    };
  }, [isSupported]); // Only re-run if isSupported changes

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear long press timeout
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }

      // Stop recognition
      const recognition = recognitionRef.current;
      if (recognition && isListening) {
        try {
          recognition.stop();
        } catch (e) {
          // Ignore errors
        }
      }
    };
  }, [isListening]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Stop dictation on Escape
    if (e.key === 'Escape' && isListening) {
      e.preventDefault();
      stopDictation();
    }

    // Call external onKeyDown if provided
    if (onKeyDown) {
      onKeyDown(e);
    }
  }, [isListening, stopDictation, onKeyDown]);

  // Also handle pointer events (works for both mouse and touch)
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    // Convert to mouse event format for our handler
    const mouseEvent = e as unknown as React.MouseEvent<HTMLTextAreaElement>;
    handleMouseDown(mouseEvent);
  }, [handleMouseDown]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    // Convert to mouse event format for our handler
    const mouseEvent = e as unknown as React.MouseEvent<HTMLTextAreaElement>;
    handleMouseUp(mouseEvent);
  }, [handleMouseUp]);

  // Combine pointer handlers with external ones
  const combinedPointerDown = useCallback((e: React.PointerEvent<HTMLTextAreaElement>) => {
    handlePointerDown(e);
    if (rest.onPointerDown) {
      rest.onPointerDown(e);
    }
  }, [handlePointerDown, rest.onPointerDown]);

  const combinedPointerUp = useCallback((e: React.PointerEvent<HTMLTextAreaElement>) => {
    handlePointerUp(e);
    if (rest.onPointerUp) {
      rest.onPointerUp(e);
    }
  }, [handlePointerUp, rest.onPointerUp]);

  // Combine internal handlers with external ones from props
  // IMPORTANT: Call our handler FIRST, then external one
  const combinedMouseDown = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    // Call our handler FIRST - it will stop propagation
    handleMouseDown(e);
    // Then call external handler if it exists
    if (rest.onMouseDown) {
      rest.onMouseDown(e);
    }
  }, [handleMouseDown, rest.onMouseDown]);

  const combinedMouseUp = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    // Call our handler FIRST - it will stop propagation
    handleMouseUp(e);
    // Then call external handler if it exists
    if (rest.onMouseUp) {
      rest.onMouseUp(e);
    }
  }, [handleMouseUp, rest.onMouseUp]);

  const combinedMouseLeave = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    handleMouseLeave(e);
    if (rest.onMouseLeave) {
      rest.onMouseLeave(e);
    }
  }, [handleMouseLeave, rest.onMouseLeave]);

  // Extract mouse/pointer handlers from rest to avoid passing them twice
  const { onMouseDown, onMouseUp, onMouseLeave, onPointerDown, onPointerUp, ...restWithoutMouseHandlers } = rest;

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
            onChange={onChange}
            onKeyDown={handleKeyDown}
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
            {...restWithoutMouseHandlers}
          />
        </SmartTooltip>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
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
          {...restWithoutMouseHandlers}
        />
      )}

      {/* Microphone icon - inside textarea, top-right corner, fixed position */}
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
            color={isListening ? '#22c55e' : '#6b7280'} // Green when listening, gray when not
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
