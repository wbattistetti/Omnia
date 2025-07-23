import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';

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

  React.useEffect(() => {
    console.log('[ActionsCatalogProvider] MOUNTED');
    return () => console.log('[ActionsCatalogProvider] UNMOUNTED');
  }, []);

  useEffect(() => {
  }, [actionsCatalog]);

  const setActionsCatalog = useCallback((actions: any[]) => {
    _setActionsCatalog(actions);
    setTimeout(() => {
    }, 100);
  }, [actionsCatalog]);

  const value = useMemo(() => {
    const v = { actionsCatalog };
    console.log("[Context] ActionsCatalog reference", v);
    return v;
  }, [actionsCatalog]);

  return (
    <ActionsCatalogContext.Provider value={value}>
      <SetActionsCatalogContext.Provider value={{ setActionsCatalog }}>
        {children}
      </SetActionsCatalogContext.Provider>
    </ActionsCatalogContext.Provider>
  );
}; 