import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DDTContextType {
  ddt: any;
  actionsCatalog: any[];
  translations: any;
  lang: string;
}

interface SetDDTContextType {
  setDDT: (ddt: any) => void;
  setActionsCatalog: (actionsCatalog: any[]) => void;
  setTranslations: (translations: any) => void;
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
  initialTranslations?: any;
  initialLang?: string;
}

export const DDTProvider: React.FC<DDTProviderProps> = ({
  children,
  initialDDT = null,
  initialActionsCatalog = [],
  initialTranslations = {},
  initialLang = 'it',
}) => {
  const [ddt, setDDT] = useState<any>(initialDDT);
  const [actionsCatalog, setActionsCatalog] = useState<any[]>(initialActionsCatalog);
  const [translations, setTranslations] = useState<any>(initialTranslations);
  const [lang, setLang] = useState<string>(initialLang);

  return (
    <DDTContext.Provider value={{ ddt, actionsCatalog, translations, lang }}>
      <SetDDTContext.Provider value={{ setDDT, setActionsCatalog, setTranslations, setLang }}>
        {children}
      </SetDDTContext.Provider>
    </DDTContext.Provider>
  );
}; 