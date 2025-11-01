import React, { useEffect, useRef, useState, useCallback, forwardRef } from 'react';
import { Mic } from 'lucide-react';

interface VoiceTextboxProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Universal textarea component with automatic speech recognition.
 *
 * Features:
 * - Auto-starts dictation when focused and empty
 * - Shows microphone icon inside the textarea automatically
 * - Handles cleanup automatically
 * - Each VoiceTextbox has its own recognition instance (no interference)
 */
export const VoiceTextbox = forwardRef<HTMLTextAreaElement, VoiceTextboxProps>(({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
  style,
  ...rest
}, forwardedRef) => {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = (forwardedRef as React.RefObject<HTMLTextAreaElement>) || internalRef;

  // Each VoiceTextbox has its own recognition instance - no sharing, no interference
  const recognitionRef = useRef<any>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const initialTextRef = useRef<string>('');
  const accumulatedFinalTextRef = useRef<string>('');
  const lastInterimTextRef = useRef<string>('');
  const isStartingRef = useRef<boolean>(false);
  const sessionIdRef = useRef<number>(0);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create dedicated recognition instance for THIS VoiceTextbox
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    // Create OWN recognition instance - independent from other VoiceTextboxes
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'it-IT';

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

  // Helper function to find longest common suffix-prefix match
  const findLongestCommonSuffixPrefix = useCallback((existing: string, newText: string) => {
    const existingTrimmed = existing.trim();
    const newTrimmed = newText.trim();

    if (!existingTrimmed || !newTrimmed) {
      return { commonLength: 0, newPart: newTrimmed, commonPart: '' };
    }

    let maxCommonLength = 0;
    const existingLower = existingTrimmed.toLowerCase();
    const newLower = newTrimmed.toLowerCase();

    for (let len = Math.min(existingLower.length, newLower.length); len > 0; len--) {
      const existingSuffix = existingLower.slice(-len);
      const newPrefix = newLower.slice(0, len);

      if (existingSuffix === newPrefix) {
        maxCommonLength = len;
        break;
      }
    }

    if (maxCommonLength > 0) {
      const commonPart = existingTrimmed.slice(-maxCommonLength);
      const newPart = newTrimmed.slice(maxCommonLength).trim();
      return { commonLength: maxCommonLength, newPart, commonPart };
    }

    return { commonLength: 0, newPart: newTrimmed, commonPart: '' };
  }, []);

  // Start recognition when focused and empty
  useEffect(() => {
    const textarea = textareaRef.current;
    const recognition = recognitionRef.current;

    if (!textarea || !isSupported || !recognition) return;

    const handleFocus = () => {
      // Cancel any pending blur timeout (focus was restored quickly)
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }

      // Prevent multiple simultaneous starts
      if (isStartingRef.current || isListening) return;

      const currentTextarea = textareaRef.current;
      if (!currentTextarea || document.activeElement !== currentTextarea) return;

      const isEmpty = !currentTextarea.value || currentTextarea.value.trim() === '';
      if (!isEmpty) return;

      // Stop any previous recognition first
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {
          // Ignore errors if not running
        }
      }

      // Mark as starting to prevent re-entry
      isStartingRef.current = true;

      // Start recognition after DOM is ready
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const currentTextarea = textareaRef.current;
          if (currentTextarea && document.activeElement === currentTextarea && !currentTextarea.value && !isListening) {
            // Set initialTextRef to current textarea value (empty in this case)
            const startValue = currentTextarea.value || '';
            initialTextRef.current = startValue;
            accumulatedFinalTextRef.current = startValue;
            lastInterimTextRef.current = '';

            // Generate new session ID to prevent cross-contamination
            sessionIdRef.current = Date.now();

            console.log('🎤 [START]', startValue ? `"${startValue}"` : 'empty', `[session: ${sessionIdRef.current}]`);

            try {
              setIsListening(true);

              // Start recognition with a small delay to ensure previous one stopped
              requestAnimationFrame(() => {
                try {
                  recognition.start();
                  isStartingRef.current = false; // Reset flag after successful start
                } catch (err: any) {
                  if (!err.message?.includes('already')) {
                    console.error('🎤 [ERROR] Start:', err.message);
                  }
                  setIsListening(false);
                  isStartingRef.current = false;
                }
              });
            } catch (error: any) {
              console.error('🎤 [ERROR] Start:', error.message);
              setIsListening(false);
              isStartingRef.current = false;
            }
          } else {
            isStartingRef.current = false;
          }
        });
      });
    };

    const handleBlur = () => {
      // Clear any pending blur timeout
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }

      // Check if textarea is actually still focused (prevent false blur during React re-renders)
      // Use a small delay to allow focus to be restored
      blurTimeoutRef.current = setTimeout(() => {
        const currentTextarea = textareaRef.current;
        if (currentTextarea && document.activeElement === currentTextarea) {
          // Still focused, ignore this blur event (probably a false blur from React re-render)
          blurTimeoutRef.current = null;
          return;
        }

        // Actually lost focus - stop recognition
        isStartingRef.current = false;
        if (recognition) {
          try {
            recognition.stop();
          } catch (e) {
            // Ignore errors if not running
          }
        }
        setIsListening(false);
        // Invalidate session to prevent stale results from applying
        sessionIdRef.current = 0;
        initialTextRef.current = '';
        accumulatedFinalTextRef.current = '';
        lastInterimTextRef.current = '';
        blurTimeoutRef.current = null;
        console.log('🎤 [STOP] blur');
      }, 50); // Small delay to check if focus was restored
    };

    textarea.addEventListener('focus', handleFocus);
    textarea.addEventListener('focusin', handleFocus);
    textarea.addEventListener('blur', handleBlur);

    // Trigger focus check immediately if already focused
    if (document.activeElement === textarea) {
      handleFocus();
    }

    return () => {
      textarea.removeEventListener('focus', handleFocus);
      textarea.removeEventListener('focusin', handleFocus);
      textarea.removeEventListener('blur', handleBlur);
      // Cleanup: clear blur timeout
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      // Cleanup: stop recognition and reset flags
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {
          // Ignore
        }
      }
      isStartingRef.current = false;
    };
  }, [isSupported]); // Removed value and isListening from dependencies to prevent infinite loops

  // Setup recognition handlers
  useEffect(() => {
    const textarea = textareaRef.current;
    const recognition = recognitionRef.current;
    if (!textarea || !recognition || !isSupported) return;

    const handleResult = (event: any) => {
      if (document.activeElement !== textarea) return;

      // Check if element is still in DOM
      if (!document.body.contains(textarea)) {
        recognition.stop();
        setIsListening(false);
        return;
      }

      // CRITICAL: Check if this session is still valid (not from a previous textarea)
      if (sessionIdRef.current === 0) {
        // Session was invalidated (blur happened), ignore these stale results
        return;
      }

      // Get current textarea value to sync with refs if they're out of sync
      const currentValue = textarea.value || '';

      // If initialTextRef doesn't match current textarea value, we switched textareas mid-recognition
      // Reset to current value and start fresh
      if (initialTextRef.current !== currentValue) {
        console.log('🎤 [SYNC] Textarea value changed, resetting refs', {
          initialRef: initialTextRef.current,
          textareaValue: currentValue,
          session: sessionIdRef.current
        });
        initialTextRef.current = currentValue;
        accumulatedFinalTextRef.current = currentValue;
        lastInterimTextRef.current = '';
      }

      // Process results with suffix-prefix matching
      let accumulatedFinal = accumulatedFinalTextRef.current || initialTextRef.current || '';
      let useReconstruction = false;

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const transcript = result[0].transcript;
          const matchResult = findLongestCommonSuffixPrefix(accumulatedFinal, transcript);

          if (matchResult.commonLength > 0 && matchResult.newPart) {
            const needsSpace = accumulatedFinal && !accumulatedFinal.endsWith(' ') && !matchResult.newPart.startsWith(' ');
            accumulatedFinal += (needsSpace ? ' ' : '') + matchResult.newPart;
          } else if (matchResult.commonLength === 0) {
            useReconstruction = true;
            break;
          }
        }
      }

      // Fallback: full reconstruction
      if (useReconstruction) {
        accumulatedFinal = initialTextRef.current || '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            const transcript = result[0].transcript;
            const needsSpace = accumulatedFinal && !accumulatedFinal.endsWith(' ') && !transcript.startsWith(' ');
            accumulatedFinal += (needsSpace ? ' ' : '') + transcript;
          }
        }
      }

      accumulatedFinalTextRef.current = accumulatedFinal;

      // Find last interim result
      let lastInterimTranscript = '';
      for (let i = event.results.length - 1; i >= 0; i--) {
        const result = event.results[i];
        if (!result.isFinal) {
          lastInterimTranscript = result[0].transcript;
          break;
        }
      }

      lastInterimTextRef.current = lastInterimTranscript;

      // Build display value
      const finalTextForDisplay = accumulatedFinal;
      let displayValue = '';

      if (finalTextForDisplay !== (initialTextRef.current || '')) {
        displayValue = finalTextForDisplay;
        if (lastInterimTranscript) {
          const needsSpace = displayValue && !displayValue.endsWith(' ') && !lastInterimTranscript.startsWith(' ');
          displayValue += (needsSpace ? ' ' : '') + lastInterimTranscript;
        }
      } else {
        displayValue = lastInterimTranscript || '';
      }

      // Update React state via onChange
      if (displayValue !== value) {
        console.log('🎤 [UPDATE]', `"${displayValue}"`);
        const syntheticEvent = {
          target: { value: displayValue },
          currentTarget: { value: displayValue },
          type: 'input',
          bubbles: true,
          cancelable: true,
        } as React.ChangeEvent<HTMLTextAreaElement>;

        onChange(syntheticEvent);
      }
    };

    const handleError = (event: any) => {
      // Only stop on critical errors, not "no-speech" (which is temporary)
      if (event.error === 'no-speech') {
        return;
      }
      // For other errors (network, service, etc), stop listening
      setIsListening(false);
    };

    const handleEnd = () => {
      setIsListening(false);
      initialTextRef.current = '';
      accumulatedFinalTextRef.current = '';
      lastInterimTextRef.current = '';
    };

    recognition.onresult = handleResult;
    recognition.onerror = handleError;
    recognition.onend = handleEnd;

    return () => {
      if (isListening) {
        try {
          recognition.stop();
        } catch (e) {
          // Ignore errors
        }
      }
    };
  }, [isSupported, value, onChange, findLongestCommonSuffixPrefix, isListening, textareaRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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

  // Handle Enter key to stop recognition
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const recognition = recognitionRef.current;

    const stopRecognitionAndReset = () => {
      if (isListening && recognition) {
        try {
          recognition.stop();
          setIsListening(false);
          sessionIdRef.current = 0; // Invalidate session
          initialTextRef.current = '';
          accumulatedFinalTextRef.current = '';
          lastInterimTextRef.current = '';
          console.log('🎤 [STOP] Enter/Escape');
        } catch (error) {
          // Ignore errors
        }
      }
    };

    if (e.key === 'Enter' && !e.shiftKey) {
      stopRecognitionAndReset();
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      stopRecognitionAndReset();
    }

    // Call external onKeyDown if provided
    if (onKeyDown) {
      onKeyDown(e);
    }
  }, [isListening, onKeyDown]);

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        style={{
          ...style,
          paddingRight: isSupported ? '24px' : (style?.paddingRight || undefined),
        }}
        {...rest}
      />

      {/* Microphone icon - inside textarea, top-right corner, fixed position */}
      {isSupported && (
        <div
          style={{
            position: 'absolute',
            top: '2px', // Fixed 2px from top
            right: '2px', // Fixed 2px from right
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
