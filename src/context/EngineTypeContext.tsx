import React, { createContext, useContext, useState, ReactNode } from 'react';

export type EngineType = 'v1' | 'serverless';

interface EngineTypeContextType {
  engineType: EngineType;
  setEngineType: (type: EngineType) => void;
}

const EngineTypeContext = createContext<EngineTypeContextType | undefined>(undefined);

export function EngineTypeProvider({ children }: { children: ReactNode }) {
  const [engineType, setEngineType] = useState<EngineType>('v1');

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
