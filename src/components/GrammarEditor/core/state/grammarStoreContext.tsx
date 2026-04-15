// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * React binding for per-instance grammar stores. Each GrammarFlow / GrammarEditor mount must wrap
 * children in GrammarStoreProvider so multiple editors do not share Zustand state.
 */

import React, { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { GrammarStore, GrammarStoreApi } from './grammarStore';

const GrammarStoreContext = createContext<GrammarStoreApi | null>(null);

export interface GrammarStoreProviderProps {
  store: GrammarStoreApi;
  children: React.ReactNode;
}

export function GrammarStoreProvider({ store, children }: GrammarStoreProviderProps) {
  return (
    <GrammarStoreContext.Provider value={store}>
      {children}
    </GrammarStoreContext.Provider>
  );
}

export function useGrammarStoreApi(): GrammarStoreApi {
  const store = useContext(GrammarStoreContext);
  if (!store) {
    throw new Error('useGrammarStoreApi must be used within GrammarStoreProvider');
  }
  return store;
}

export function useGrammarStore(): GrammarStore;
export function useGrammarStore<T>(selector: (state: GrammarStore) => T): T;
export function useGrammarStore<T>(selector?: (state: GrammarStore) => T) {
  const store = useGrammarStoreApi();
  if (selector) {
    return useStore(store, selector);
  }
  return useStore(store);
}
