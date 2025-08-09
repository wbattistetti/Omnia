import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { getAllDialogueTemplates, getIDETranslations, getDataDialogueTranslations } from '../services/ProjectDataService';

interface DDTManagerContextType {
  ddtList: any[];
  selectedDDT: any | null;
  isLoadingDDT: boolean;
  loadDDTError: string | null;
  ideTranslations: Record<string, string>;
  dataDialogueTranslations: Record<string, string>;
  setDataDialogueTranslations: (t: Record<string, string>) => void;
  createDDT: (ddt: any) => void;
  openDDT: (ddt: any) => void;
  closeDDT: () => void;
  deleteDDT: (id: string) => void;
  loadDDT: () => Promise<void>;
  updateTranslation: (key: string, value: string) => void;
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
  const [ideTranslations, setIdeTranslations] = useState<Record<string, string>>({});
  const [dataDialogueTranslations, setDataDialogueTranslations] = useState<Record<string, string>>({});

  const createDDT = (ddt: any) => {
    // ensure has id for future lookups
    const withId = ddt.id ? ddt : { ...ddt, id: ddt._id || `${(ddt.label || 'DDT').replace(/\s+/g, '_')}_${crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}` };
    setDDTList(prev => [...prev, withId]);
    setSelectedDDT(withId);
  };

  const openDDT = (ddt: any) => {
    setSelectedDDT(ddt);
  };

  const closeDDT = () => {
    setSelectedDDT(null);
  };

  const deleteDDT = (id: string) => {
    setDDTList(prev => prev.filter(ddt => ddt.id !== id && ddt._id !== id));
    if (selectedDDT && (selectedDDT.id === id || selectedDDT._id === id)) {
      setSelectedDDT(null);
    }
  };

  // Aggiorna una traduzione per il DDT selezionato e sincronizza la lista
  const updateTranslation = (key: string, value: string) => {
    setSelectedDDT((prev: any) => {
      if (!prev) return prev;
      const prevTrans = (prev.translations && (prev.translations.en || prev.translations)) || {};
      const nextTranslations = {
        ...(prev.translations || {}),
        en: { ...prevTrans, [key]: value }
      };
      const next = { ...prev, translations: nextTranslations };
      setDDTList(list => list.map(d => (d.id === prev.id || d._id === prev._id ? next : d)));
      return next;
    });
  };

  const loadDDT = async () => {
    setIsLoadingDDT(true);
    setLoadDDTError(null);
    try {
      const [ddtTemplates, ide, ddtTr] = await Promise.all([
        getAllDialogueTemplates(),
        getIDETranslations().catch(() => ({})),
        getDataDialogueTranslations().catch(() => ({}))
      ]);
      setDDTList(ddtTemplates);
      setIdeTranslations(ide || {});
      setDataDialogueTranslations(ddtTr || {});
      try {
        const ideCount = ide ? Object.keys(ide).length : 0;
        const ddtCount = ddtTr ? Object.keys(ddtTr).length : 0;
        console.log('[DDTManager] Translations loaded:', { ideCount, ddtCount });
      } catch {}
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
    ideTranslations,
    dataDialogueTranslations,
    setDataDialogueTranslations,
    createDDT,
    openDDT,
    closeDDT,
    deleteDDT,
    loadDDT,
    updateTranslation
  };

  return (
    <DDTManagerContext.Provider value={value}>
      {children}
    </DDTManagerContext.Provider>
  );
}; 