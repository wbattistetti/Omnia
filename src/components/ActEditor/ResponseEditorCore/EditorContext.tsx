import React, { createContext, useContext } from 'react';

// Tipo per il context - Miglioria: selectedStep sempre string
interface EditorContextType {
  selectedStep: string; // Miglioria: mai null
  selectedNodeIndex: number | null;
  nodes: any[];
  filteredNodes: any[];
  selectedNode: any;
  actionCatalog: any[];
  showLabel: boolean; // ✅ NUOVO: aggiunto showLabel
  setStep: (step: string) => void;
  setSelectedNodeIndex: (index: number | null) => void;
  setActionCatalog: (catalog: any[]) => void;
  removeNode: (id: string) => void; // Nuovo: rimozione nodi
  toggleShowLabel: () => void; // ✅ NUOVO: aggiunto toggleShowLabel
  addEscalation: () => void; // ✅ NUOVO: aggiunta escalation
  handleDrop: (targetId: string | null, position: 'before' | 'after' | 'child', item: any) => void; // ✅ NUOVO: aggiunto drop
  extractedNodes: any[];
}

// Context
const EditorContext = createContext<EditorContextType | null>(null);

// Provider
export const EditorProvider: React.FC<{
  value: EditorContextType;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
};

// Hook per usare il context
export const useEditorContext = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditorContext must be used within EditorProvider');
  }
  return context;
}; 