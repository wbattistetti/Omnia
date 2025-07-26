import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DDTContextType {
  ddt: any;
  actionsCatalog: any[];
  translationsByDDT: { [ddtId: string]: any };
  lang: string;
  setTranslationsForDDT: (ddtId: string, translations: any) => void;
  getTranslationsForDDT: (ddtId: string) => any;
}

interface SetDDTContextType {
  setDDT: (ddt: any) => void;
  setActionsCatalog: (actionsCatalog: any[]) => void;
  setLang: (lang: string) => void;
}

const DDTContext = createContext<DDTContextType | undefined>(undefined);
const SetDDTContext = createContext<SetDDTContextType | undefined>(undefined);

export const useDDTContext = () => {
  const context = useContext(DDTContext);
  if (context === undefined) {
    throw new Error('useDDTContext must be used within a DDTProvider');
  }
  return context;
};

export const useSetDDTContext = () => {
  const context = useContext(SetDDTContext);
  if (context === undefined) {
    throw new Error('useSetDDTContext must be used within a DDTProvider');
  }
  return context;
};

interface DDTProviderProps {
  children: ReactNode;
  initialDDT?: any;
  initialActionsCatalog?: any[];
  initialTranslationsByDDT?: { [ddtId: string]: any };
  initialLang?: string;
}

export const DDTProvider: React.FC<DDTProviderProps> = ({
  children,
  initialDDT = null,
  initialActionsCatalog = [],
  initialTranslationsByDDT = {},
  initialLang = 'it',
}) => {
  const [ddt, setDDT] = useState<any>(initialDDT);
  const [actionsCatalog, setActionsCatalog] = useState<any[]>(initialActionsCatalog);
  const [translationsByDDT, setTranslationsByDDT] = useState<{ [ddtId: string]: any }>(initialTranslationsByDDT);
  const [lang, setLang] = useState<string>(initialLang);

  const setTranslationsForDDT = (ddtId: string, translations: any) => {
    setTranslationsByDDT(prev => ({ ...prev, [ddtId]: translations }));
  };
  const getTranslationsForDDT = (ddtId: string) => translationsByDDT[ddtId] || {};

  return (
    <DDTContext.Provider value={{ ddt, actionsCatalog, translationsByDDT, lang, setTranslationsForDDT, getTranslationsForDDT }}>
      <SetDDTContext.Provider value={{ setDDT, setActionsCatalog, setLang }}>
        {children}
      </SetDDTContext.Provider>
    </DDTContext.Provider>
  );
}; 