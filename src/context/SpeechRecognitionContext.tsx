import React, { createContext, useContext, useRef, useState, ReactNode, useMemo } from 'react';

interface SpeechRecognitionContextType {
  isSupported: boolean;
  getRecognition: () => any | null;
}

const SpeechRecognitionContext = createContext<SpeechRecognitionContextType | null>(null);

export function SpeechRecognitionProvider({ children }: { children: ReactNode }) {
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  React.useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    // Create recognition instance once
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
      }
    };
  }, []);

  const getRecognition = useMemo(() => () => recognitionRef.current, []);

  return (
    <SpeechRecognitionContext.Provider
      value={{
        isSupported,
        getRecognition
      }}
    >
      {children}
    </SpeechRecognitionContext.Provider>
  );
}

export function useSpeechRecognition() {
  const context = useContext(SpeechRecognitionContext);
  if (!context) {
    throw new Error('useSpeechRecognition must be used within SpeechRecognitionProvider');
  }
  return context;
}

