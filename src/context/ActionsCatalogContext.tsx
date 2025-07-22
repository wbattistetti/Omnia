import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';

interface ActionsCatalogContextType {
  actionsCatalog: any[];
}

interface SetActionsCatalogContextType {
  setActionsCatalog: (actions: any[]) => void;
}

const ActionsCatalogContext = createContext<ActionsCatalogContextType | undefined>(undefined);
const SetActionsCatalogContext = createContext<SetActionsCatalogContextType | undefined>(undefined);

export const useActionsCatalog = () => {
  const context = useContext(ActionsCatalogContext);
  if (context === undefined) {
    throw new Error('useActionsCatalog must be used within an ActionsCatalogProvider');
  }
  return context;
};

export const useSetActionsCatalog = () => {
  const context = useContext(SetActionsCatalogContext);
  if (context === undefined) {
    throw new Error('useSetActionsCatalog must be used within an ActionsCatalogProvider');
  }
  return context;
};

interface ActionsCatalogProviderProps {
  children: ReactNode;
  initialActions?: any[];
}

export const ActionsCatalogProvider: React.FC<ActionsCatalogProviderProps> = ({ children, initialActions = [] }) => {
  const [actionsCatalog, _setActionsCatalog] = useState<any[]>(initialActions);

  useEffect(() => {
  }, []);

  useEffect(() => {
  }, [actionsCatalog]);

  const setActionsCatalog = useCallback((actions: any[]) => {
    _setActionsCatalog(actions);
    setTimeout(() => {
    }, 100);
  }, [actionsCatalog]);

  return (
    <ActionsCatalogContext.Provider value={{ actionsCatalog }}>
      <SetActionsCatalogContext.Provider value={{ setActionsCatalog }}>
        {children}
      </SetActionsCatalogContext.Provider>
    </ActionsCatalogContext.Provider>
  );
}; 