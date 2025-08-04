import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { getAllDialogueTemplates } from '../services/ProjectDataService';

interface DDTManagerContextType {
  ddtList: any[];
  selectedDDT: any | null;
  isLoadingDDT: boolean;
  loadDDTError: string | null;
  createDDT: (ddt: any) => void;
  openDDT: (ddt: any) => void;
  closeDDT: () => void;
  deleteDDT: (id: string) => void;
  loadDDT: () => Promise<void>;
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
  const [isLoadingDDT, setIsLoadingDDT] = useState(false);
  const [loadDDTError, setLoadDDTError] = useState<string | null>(null);

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

  const loadDDT = async () => {
    console.log('[DDTManagerContext] loadDDT chiamato');
    setIsLoadingDDT(true);
    setLoadDDTError(null);
    try {
      const ddtTemplates = await getAllDialogueTemplates();
      console.log('[DDTManagerContext] DDT caricati dal database:', ddtTemplates);
      setDDTList(ddtTemplates);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore nel caricamento DDT';
      setLoadDDTError(errorMessage);
      console.error('[DDTManagerContext] Errore caricamento DDT:', err);
    } finally {
      setIsLoadingDDT(false);
    }
  };

  // Carica i DDT all'inizializzazione
  useEffect(() => {
    loadDDT();
  }, []);

  const value = {
    ddtList,
    selectedDDT,
    isLoadingDDT,
    loadDDTError,
    createDDT,
    openDDT,
    closeDDT,
    deleteDDT,
    loadDDT
  };

  return (
    <DDTManagerContext.Provider value={value}>
      {children}
    </DDTManagerContext.Provider>
  );
}; 