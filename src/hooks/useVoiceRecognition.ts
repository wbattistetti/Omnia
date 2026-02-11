import { useEffect, useRef, useState, useCallback } from 'react';

export interface UseVoiceRecognitionOptions {
  value: string;
  onChange: (e: { target: { value: string }; currentTarget: { value: string } }) => void;
  autoStartWhenEmpty?: boolean;
  elementRef: React.RefObject<HTMLElement>;
}

export interface UseVoiceRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  isLongPressing: boolean;
  startDictation: () => void;
  stopDictation: () => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseUp: (e: React.MouseEvent) => void;
  handleMouseLeave: () => void;
  handlePointerDown: (e: React.PointerEvent) => void;
  handlePointerUp: (e: React.PointerEvent) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleFocus: (e: React.FocusEvent) => void;
  handleChange: (e: React.ChangeEvent) => void;
}

/**
 * Shared hook for voice recognition functionality.
 * Can be used by both VoiceTextbox and VoiceInput components.
 */
export function useVoiceRecognition({
  value,
  onChange,
  autoStartWhenEmpty = false,
  elementRef,
}: UseVoiceRecognitionOptions): UseVoiceRecognitionReturn {
  const recognitionRef = useRef<any>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);

  // Track long press state
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActiveRef = useRef<boolean>(false);
  const autoStartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track recognition session
  const baseTextRef = useRef<string>('');
  const isListeningRef = useRef<boolean>(false);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const lastProcessedIndexRef = useRef<number>(0);

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
    const element = elementRef.current;
    const recognition = recognitionRef.current;

    if (!element || !recognition || isListening) return;

    // Save current text as base and reset processed index
    baseTextRef.current = value || '';
    lastProcessedIndexRef.current = 0;

    try {
      setIsListening(true);
      recognition.start();
    } catch (err: any) {
      if (!err.message?.includes('already')) {
        // Silent fail
      }
      setIsListening(false);
    }
  }, [value, isListening, elementRef]);

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
    lastProcessedIndexRef.current = 0;
  }, [isListening]);

  // Setup recognition event handlers
  useEffect(() => {
    const element = elementRef.current;
    const recognition = recognitionRef.current;

    if (!element || !recognition || !isSupported) return;

    const handleResult = (event: any) => {
      const currentElement = elementRef.current;
      if (!isListeningRef.current || !currentElement || document.activeElement !== currentElement) {
        return;
      }

      // Check if element is still in DOM
      if (!document.body.contains(currentElement)) {
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

      // Process only NEW final results
      let finalText = baseTextRef.current;
      let processedAnyNew = false;

      for (let i = lastProcessedIndexRef.current; i < results.length; i++) {
        const result = results[i];
        if (result.isFinal && result[0]) {
          const transcript = result[0].transcript;
          if (finalText && !finalText.endsWith(' ') && !transcript.startsWith(' ')) {
            finalText += ' ';
          }
          finalText += transcript;
          processedAnyNew = true;
        }
      }

      if (processedAnyNew) {
        lastProcessedIndexRef.current = results.length;
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
        };

        onChangeRef.current(syntheticEvent);
      }
    };

    const handleError = (event: any) => {
      if (event.error === 'no-speech') {
        return;
      }
      console.error('🎤 [ERROR]', event.error);
      const recognition = recognitionRef.current;
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {}
      }
      setIsListening(false);
      baseTextRef.current = '';
      lastProcessedIndexRef.current = 0;
    };

    const handleEnd = () => {
      setIsListening(false);
      baseTextRef.current = '';
      lastProcessedIndexRef.current = 0;
    };

    recognition.onresult = handleResult;
    recognition.onerror = handleError;
    recognition.onend = handleEnd;

    return () => {
      if (isListeningRef.current) {
        try {
          recognition.stop();
        } catch (e) {
          // Ignore errors
        }
      }
    };
  }, [isSupported, elementRef]);

  // Auto-start dictation when element is empty and focused
  useEffect(() => {
    if (!autoStartWhenEmpty || !isSupported) return;

    const element = elementRef.current;
    if (!element) return;

    const isEmpty = !value || value.trim() === '';
    const isFocused = document.activeElement === element;

    if (isEmpty && isFocused && !isListening && !isLongPressing) {
      autoStartTimeoutRef.current = setTimeout(() => {
        const currentElement = elementRef.current;
        if (currentElement && document.activeElement === currentElement && !isListeningRef.current) {
          startDictation();
        }
        autoStartTimeoutRef.current = null;
      }, 200);
    }

    return () => {
      if (autoStartTimeoutRef.current) {
        clearTimeout(autoStartTimeoutRef.current);
        autoStartTimeoutRef.current = null;
      }
    };
  }, [autoStartWhenEmpty, isSupported, value, isListening, isLongPressing, startDictation, elementRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
      if (autoStartTimeoutRef.current) {
        clearTimeout(autoStartTimeoutRef.current);
      }
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

  // Handle mouse down - start long press timer
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isSupported) {
      return;
    }

    e.stopPropagation();

    // If already listening, stop dictation on click
    if (isListening) {
      stopDictation();
      return;
    }

    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }

    isLongPressActiveRef.current = false;
    setIsLongPressing(false);

    longPressTimeoutRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      setIsLongPressing(true);
      startDictation();
    }, 300);
  }, [isSupported, isListening, startDictation, stopDictation]);

  // Handle mouse up
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    if (isListening) {
      stopDictation();
    }

    isLongPressActiveRef.current = false;
    setIsLongPressing(false);
  }, [isListening, stopDictation]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    if (isListening) {
      stopDictation();
    }

    isLongPressActiveRef.current = false;
    setIsLongPressing(false);
  }, [isListening, stopDictation]);

  // Handle pointer events
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    const mouseEvent = e as unknown as React.MouseEvent;
    handleMouseDown(mouseEvent);
  }, [handleMouseDown]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    const mouseEvent = e as unknown as React.MouseEvent;
    handleMouseUp(mouseEvent);
  }, [handleMouseUp]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isListening) {
      const isModifierOnly = e.key === 'Control' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Meta';
      if (e.key !== 'Escape' && !isModifierOnly) {
        stopDictation();
      }
    }

    if (e.key === 'Escape' && isListening) {
      e.preventDefault();
      stopDictation();
    }
  }, [isListening, stopDictation]);

  // Handle focus
  const handleFocus = useCallback((e: React.FocusEvent) => {
    if (autoStartTimeoutRef.current) {
      clearTimeout(autoStartTimeoutRef.current);
      autoStartTimeoutRef.current = null;
    }

    if (isListening) {
      stopDictation();
    }

    if (autoStartWhenEmpty && isSupported) {
      const isEmpty = !value || value.trim() === '';
      if (isEmpty && !isListening && !isLongPressing) {
        autoStartTimeoutRef.current = setTimeout(() => {
          const element = elementRef.current;
          if (element && document.activeElement === element && !isListeningRef.current) {
            startDictation();
          }
          autoStartTimeoutRef.current = null;
        }, 150);
      }
    }
  }, [autoStartWhenEmpty, isSupported, value, isListening, isLongPressing, startDictation, stopDictation, elementRef]);

  // Handle change
  const handleChange = useCallback((e: React.ChangeEvent) => {
    if (isListening) {
      stopDictation();
    }
  }, [isListening, stopDictation]);

  return {
    isSupported,
    isListening,
    isLongPressing,
    startDictation,
    stopDictation,
    handleMouseDown,
    handleMouseUp,
    handleMouseLeave,
    handlePointerDown,
    handlePointerUp,
    handleKeyDown,
    handleFocus,
    handleChange,
  };
}
