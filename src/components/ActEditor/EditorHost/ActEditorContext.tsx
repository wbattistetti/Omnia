import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ActMeta } from './types';

type Ctx = {
  act?: ActMeta;
  open: (act: ActMeta) => void;
  close: () => void;
};

const ActEditorContext = createContext<Ctx | null>(null);

export function useActEditor(){
  const ctx = useContext(ActEditorContext);
  if(!ctx) throw new Error('useActEditor must be used within ActEditorProvider');
  return ctx;
}

export function ActEditorProvider({ children }: { children: React.ReactNode }){
  const [act, setAct] = useState<ActMeta | undefined>();
  useEffect(() => {
    try { localStorage.setItem('debug.intent', '1'); } catch {}
  }, []);
  const open = (a: ActMeta) => {
    try { if (localStorage.getItem('debug.intent') === '1') console.log('[ActEditor][open]', a); } catch {}
    setAct(a);
  };
  const close = () => {
    try { if (localStorage.getItem('debug.intent') === '1') console.log('[ActEditor][close]'); } catch {}
    setAct(undefined);
  };
  try { if (localStorage.getItem('debug.intent') === '1') console.log('[ActEditor][provider.mount]'); } catch {}
  return (
    <ActEditorContext.Provider value={{ act, open, close }}>{children}</ActEditorContext.Provider>
  );
}


