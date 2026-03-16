// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';

interface DragState {
  sourceNodeId: string;
  startPos: { x: number; y: number };
}

interface DragContextValue {
  dragState: DragState | null;
  setDragState: (state: DragState | null) => void;
}

const DragContext = React.createContext<DragContextValue | null>(null);

export function DragProvider({ children }: { children: React.ReactNode }) {
  const [dragState, setDragState] = React.useState<DragState | null>(null);

  return (
    <DragContext.Provider value={{ dragState, setDragState }}>
      {children}
    </DragContext.Provider>
  );
}

export function useDrag() {
  const context = React.useContext(DragContext);
  if (!context) {
    throw new Error('useDrag must be used within DragProvider');
  }
  return context;
}
