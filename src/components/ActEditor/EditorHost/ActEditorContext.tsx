import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ActMeta } from './types';


type Ctx = {
  act?: ActMeta;
  open: (act: ActMeta) => void;
  close: () => void;
};

const ActEditorContext = createContext<Ctx | null>(null);

export function useActEditor() {
  const ctx = useContext(ActEditorContext);
  if (!ctx) throw new Error('useActEditor must be used within ActEditorProvider');
  return ctx;
}

export function ActEditorProvider({ children }: { children: React.ReactNode }) {
  const [act, setAct] = useState<ActMeta | undefined>();
  useEffect(() => {
  }, []);
  const open = (a: ActMeta) => {
    try { console.log('[ActEditor][open] Full act object:', JSON.stringify(a, null, 2)); } catch { }
    setAct(a);
  };
  const close = () => {
    try { console.log('[ActEditor][close]'); } catch { }
    setAct(undefined);
  };
  return (
    <ActEditorContext.Provider value={{ act, open, close }}>{children}</ActEditorContext.Provider>
  );
}


