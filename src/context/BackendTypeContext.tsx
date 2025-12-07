import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type BackendType = 'react' | 'vbnet';

interface BackendTypeContextType {
  backendType: BackendType;
  setBackendType: (type: BackendType) => void;
  toggleBackendType: () => void;
}

const BackendTypeContext = createContext<BackendTypeContextType | undefined>(undefined);

const STORAGE_KEY = 'omnia_backend_type';

export function BackendTypeProvider({ children }: { children: React.ReactNode }) {
  // Load from localStorage on mount
  const [backendType, setBackendTypeState] = useState<BackendType>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'react' || stored === 'vbnet') {
        return stored;
      }
    } catch (e) {
      console.warn('[BackendTypeContext] Failed to load from localStorage', e);
    }
    return 'react'; // Default to React (Ruby backend)
  });

  // Save to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, backendType);
      console.log(`[BackendTypeContext] Backend type set to: ${backendType}`);
    } catch (e) {
      console.warn('[BackendTypeContext] Failed to save to localStorage', e);
    }
  }, [backendType]);

  const setBackendType = useCallback((type: BackendType) => {
    setBackendTypeState(type);
  }, []);

  const toggleBackendType = useCallback(() => {
    setBackendTypeState(prev => prev === 'react' ? 'vbnet' : 'react');
  }, []);

  return (
    <BackendTypeContext.Provider value={{ backendType, setBackendType, toggleBackendType }}>
      {children}
    </BackendTypeContext.Provider>
  );
}

export function useBackendType(): BackendTypeContextType {
  const context = useContext(BackendTypeContext);
  if (context === undefined) {
    throw new Error('useBackendType must be used within a BackendTypeProvider');
  }
  return context;
}

/**
 * Hook to get the base URL for API calls based on backend type
 */
export function useBackendBaseUrl(): string {
  const { backendType } = useBackendType();
  return backendType === 'vbnet' ? 'http://localhost:5000' : 'http://localhost:3100';
}


