import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DDTManagerContextType {
  ddtList: any[];
  selectedDDT: any | null;
  createDDT: (ddt: any) => void;
  openDDT: (ddt: any) => void;
  closeDDT: () => void;
  deleteDDT: (id: string) => void;
}

const DDTManagerContext = createContext<DDTManagerContextType | null>(null);

export const useDDTManager = () => {
  const context = useContext(DDTManagerContext);
  if (!context) {
    throw new Error('useDDTManager must be used within a DDTManagerProvider');
  }
  return context;
};

interface DDTManagerProviderProps {
  children: ReactNode;
}

export const DDTManagerProvider: React.FC<DDTManagerProviderProps> = ({ children }) => {
  const [ddtList, setDDTList] = useState<any[]>([]);
  const [selectedDDT, setSelectedDDT] = useState<any | null>(null);

  const createDDT = (ddt: any) => {
    console.log('[DDTManagerContext] createDDT chiamato con:', ddt);
    setDDTList(prev => [...prev, ddt]);
    setSelectedDDT(ddt); // Apre automaticamente l'editor
  };

  const openDDT = (ddt: any) => {
    console.log('[DDTManagerContext] openDDT chiamato per:', ddt.label || ddt.name);
    setSelectedDDT(ddt);
  };

  const closeDDT = () => {
    console.log('[DDTManagerContext] closeDDT chiamato');
    setSelectedDDT(null);
  };

  const deleteDDT = (id: string) => {
    console.log('[DDTManagerContext] deleteDDT chiamato per ID:', id);
    setDDTList(prev => prev.filter(ddt => ddt.id !== id && ddt._id !== id));
    // Se l'editor è aperto per questo DDT, chiudilo
    if (selectedDDT && (selectedDDT.id === id || selectedDDT._id === id)) {
      setSelectedDDT(null);
    }
  };

  const value = {
    ddtList,
    selectedDDT,
    createDDT,
    openDDT,
    closeDDT,
    deleteDDT
  };

  return (
    <DDTManagerContext.Provider value={value}>
      {children}
    </DDTManagerContext.Provider>
  );
}; 