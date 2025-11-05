import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/**
 * Condizione in memoria (non salvata nel database)
 */
export interface InMemoryCondition {
  id: string; // ID univoco generato (es. 'inmemory-{timestamp}-{random}')
  name: string; // Nome della condizione (testo digitato dall'utente)
  label: string; // Label (uguale a name per ora)
  script?: string; // Script opzionale (vuoto di default)
  createdAt: number; // Timestamp di creazione
}

interface InMemoryConditionsContextType {
  conditions: InMemoryCondition[];
  addCondition: (name: string, script?: string) => InMemoryCondition;
  getConditionById: (id: string) => InMemoryCondition | undefined;
  updateCondition: (id: string, updates: Partial<InMemoryCondition>) => void;
  removeCondition: (id: string) => void;
  clearConditions: () => void;
}

const InMemoryConditionsContext = createContext<InMemoryConditionsContextType | undefined>(undefined);

export const useInMemoryConditions = () => {
  const context = useContext(InMemoryConditionsContext);
  if (!context) {
    throw new Error('useInMemoryConditions must be used within InMemoryConditionsProvider');
  }
  return context;
};

interface InMemoryConditionsProviderProps {
  children: ReactNode;
}

export const InMemoryConditionsProvider: React.FC<InMemoryConditionsProviderProps> = ({ children }) => {
  const [conditions, setConditions] = useState<InMemoryCondition[]>([]);

  const addCondition = useCallback((name: string, script?: string): InMemoryCondition => {
    // Genera ID univoco
    const id = `inmemory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newCondition: InMemoryCondition = {
      id,
      name: name.trim(),
      label: name.trim(),
      script: script || undefined,
      createdAt: Date.now()
    };

    setConditions((prev) => {
      // Evita duplicati: se esiste già una condizione con lo stesso name, non aggiungerla
      const exists = prev.some(c => c.name.toLowerCase() === name.trim().toLowerCase());
      if (exists) {
        // Ritorna la condizione esistente
        return prev;
      }
      return [...prev, newCondition];
    });

    return newCondition;
  }, []);

  const getConditionById = useCallback((id: string): InMemoryCondition | undefined => {
    return conditions.find(c => c.id === id);
  }, [conditions]);

  const updateCondition = useCallback((id: string, updates: Partial<InMemoryCondition>) => {
    setConditions((prev) =>
      prev.map(c => c.id === id ? { ...c, ...updates } : c)
    );
  }, []);

  const removeCondition = useCallback((id: string) => {
    setConditions((prev) => prev.filter(c => c.id !== id));
  }, []);

  const clearConditions = useCallback(() => {
    setConditions([]);
  }, []);

  return (
    <InMemoryConditionsContext.Provider
      value={{
        conditions,
        addCondition,
        getConditionById,
        updateCondition,
        removeCondition,
        clearConditions
      }}
    >
      {children}
    </InMemoryConditionsContext.Provider>
  );
};

