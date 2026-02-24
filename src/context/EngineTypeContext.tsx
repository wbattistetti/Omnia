import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type EngineType = 'typescript' | 'vbnet';

interface EngineTypeContextType {
  engineType: EngineType;
  setEngineType: (type: EngineType) => void;
}

const EngineTypeContext = createContext<EngineTypeContextType | undefined>(undefined);

export function EngineTypeProvider({ children }: { children: ReactNode }) {
  const [engineType, setEngineType] = useState<EngineType>(() => {
    try {
      const saved = localStorage.getItem('engineType');
      return (saved === 'typescript' || saved === 'vbnet') ? saved : 'typescript';
    } catch {
      return 'typescript';
    }
  });

  // Save to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('engineType', engineType);
    } catch {}
  }, [engineType]);

  return (
    <EngineTypeContext.Provider value={{ engineType, setEngineType }}>
      {children}
    </EngineTypeContext.Provider>
  );
}

export function useEngineType() {
  const context = useContext(EngineTypeContext);
  if (context === undefined) {
    throw new Error('useEngineType must be used within an EngineTypeProvider');
  }
  return context;
}
