import React, { createContext, useContext, useCallback } from 'react';

interface FlowTestContextValue {
  testSingleNode: (nodeId: string, nodeRows?: any[]) => Promise<void>;
}

const FlowTestContext = createContext<FlowTestContextValue | null>(null);

interface FlowTestProviderProps {
  children: React.ReactNode;
  testSingleNode: (nodeId: string, nodeRows?: any[]) => Promise<void>;
}

export const FlowTestProvider: React.FC<FlowTestProviderProps> = ({
  children,
  testSingleNode
}) => {
  // ✅ Memoize the context value to prevent unnecessary re-renders
  const value = React.useMemo(() => ({
    testSingleNode
  }), [testSingleNode]);

  return (
    <FlowTestContext.Provider value={value}>
      {children}
    </FlowTestContext.Provider>
  );
};

export function useFlowTest(): FlowTestContextValue {
  const context = useContext(FlowTestContext);
  if (!context) {
    throw new Error('useFlowTest must be used within FlowTestProvider');
  }
  return context;
}
