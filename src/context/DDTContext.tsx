import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TaskTreeContextType {
  taskTree: any;
  actionsCatalog: any[];
  translationsByTaskTree: { [taskTreeId: string]: any };
  lang: string;
  setTranslationsForTaskTree: (taskTreeId: string, translations: any) => void;
  getTranslationsForTaskTree: (taskTreeId: string) => any;
}

interface SetTaskTreeContextType {
  setTaskTree: (taskTree: any) => void;
  setActionsCatalog: (actionsCatalog: any[]) => void;
  setLang: (lang: string) => void;
}

const TaskTreeContext = createContext<TaskTreeContextType | undefined>(undefined);
const SetTaskTreeContext = createContext<SetTaskTreeContextType | undefined>(undefined);

export const useTaskTreeContext = () => {
  const context = useContext(TaskTreeContext);
  if (context === undefined) {
    throw new Error('useTaskTreeContext must be used within a TaskTreeProvider');
  }
  return context;
};

export const useSetTaskTreeContext = () => {
  const context = useContext(SetTaskTreeContext);
  if (context === undefined) {
    throw new Error('useSetTaskTreeContext must be used within a TaskTreeProvider');
  }
  return context;
};

interface TaskTreeProviderProps {
  children: ReactNode;
  initialTaskTree?: any;
  initialActionsCatalog?: any[];
  initialTranslationsByTaskTree?: { [taskTreeId: string]: any };
  initialLang?: string;
}

export const TaskTreeProvider: React.FC<TaskTreeProviderProps> = ({
  children,
  initialTaskTree = null,
  initialActionsCatalog = [],
  initialTranslationsByTaskTree = {},
  initialLang = 'it',
}) => {
  const [taskTree, setTaskTree] = useState<any>(initialTaskTree);
  const [actionsCatalog, setActionsCatalog] = useState<any[]>(initialActionsCatalog);
  const [translationsByTaskTree, setTranslationsByTaskTree] = useState<{ [taskTreeId: string]: any }>(initialTranslationsByTaskTree);
  const [lang, setLang] = useState<string>(initialLang);

  const setTranslationsForTaskTree = (taskTreeId: string, translations: any) => {
    setTranslationsByTaskTree(prev => ({ ...prev, [taskTreeId]: translations }));
  };
  const getTranslationsForTaskTree = (taskTreeId: string) => translationsByTaskTree[taskTreeId] || {};

  return (
    <TaskTreeContext.Provider value={{ taskTree, actionsCatalog, translationsByTaskTree, lang, setTranslationsForTaskTree, getTranslationsForTaskTree }}>
      <SetTaskTreeContext.Provider value={{ setTaskTree, setActionsCatalog, setLang }}>
        {children}
      </SetTaskTreeContext.Provider>
    </TaskTreeContext.Provider>
  );
};