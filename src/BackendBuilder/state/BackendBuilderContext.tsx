import React from 'react';

type StepKey = 'design' | 'sources' | 'plan' | 'policies' | 'usecases' | 'codegen';

export type ChatMessage = {
  id: string;
  role: 'designer' | 'ai';
  text: string;
  ts: number;
};

interface BackendBuilderState {
  currentStep: StepKey;
  setCurrentStep: (s: StepKey) => void;

  // Guided chat state
  messages: ChatMessage[];
  addMessage: (m: Omit<ChatMessage, 'id' | 'ts'>) => void;
  aiTyping: boolean;
  replyFromAI: (extra?: Array<{ role: 'designer' | 'ai'; text: string }>) => Promise<void>;

  // Context state accumulated across turns
  contextState: string;
  setContextState: (s: string) => void;
  appendContext: (delta: string) => void;
  lastDelta: string;
  clearDelta: () => void;
}

const Ctx = React.createContext<BackendBuilderState | null>(null);

export function BackendBuilderProvider({ children }: { children: React.ReactNode }) {
  const [currentStep, setCurrentStep] = React.useState<StepKey>('design');

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const addMessage = React.useCallback((m: Omit<ChatMessage, 'id' | 'ts'>) => {
    setMessages(prev => [...prev, { ...m, id: Math.random().toString(36).slice(2), ts: Date.now() }]);
  }, []);

  const [aiTyping, setAiTyping] = React.useState<boolean>(false);

  // Context persistence (localStorage)
  const [contextState, setContextState] = React.useState<string>(() => {
    try { return localStorage.getItem('bb.contextState') || ''; } catch { return ''; }
  });
  React.useEffect(() => { try { localStorage.setItem('bb.contextState', contextState || ''); } catch {} }, [contextState]);
  const appendContext = React.useCallback((delta: string) => {
    if (!delta) return;
    setContextState(prev => (prev ? prev + '\n' + delta : delta));
    setLastDelta('');
  }, []);

  const [lastDelta, setLastDelta] = React.useState<string>('');
  const clearDelta = React.useCallback(() => setLastDelta(''), []);

  const replyFromAI = React.useCallback(async (extra?: Array<{ role: 'designer' | 'ai'; text: string }>) => {
    setAiTyping(true);
    try {
      const serialMsgs = messages.map(m => ({ role: m.role, text: m.text }));
      const payload = { messages: [...serialMsgs, ...(extra || [])], context: contextState };
      const res = await fetch('/api/builder/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data && data.ok) {
        const text = String(data.text || data.outline || '');
        const delta = String(data.delta || '');
        if (text) addMessage({ role: 'ai', text });
        setLastDelta(delta || '');
      } else if (data && data.error) {
        addMessage({ role: 'ai', text: `Errore: ${String(data.error)}` });
      }
    } catch (e: any) {
      addMessage({ role: 'ai', text: 'Errore di rete nel contattare l\'IA.' });
    } finally {
      setAiTyping(false);
    }
  }, [messages, addMessage, contextState]);

  const value = React.useMemo(() => ({
    currentStep, setCurrentStep,

    messages, addMessage, aiTyping, replyFromAI,

    contextState, setContextState, appendContext, lastDelta, clearDelta,
  }), [currentStep, messages, aiTyping, replyFromAI, contextState, appendContext, lastDelta, clearDelta]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBackendBuilder() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('BackendBuilderContext missing');
  return ctx;
}

