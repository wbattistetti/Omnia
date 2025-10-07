import { useState, useCallback } from 'react';
import { IntellisenseItem } from '../components/Intellisense/IntellisenseTypes';

export interface IntellisenseState {
  isOpen: boolean;
  query: string;
  position: { x: number; y: number };
  selectedIndex: number;
  items: IntellisenseItem[];
}

export interface IntellisenseActions {
  openIntellisense: (query: string, position: { x: number; y: number }) => void;
  closeIntellisense: () => void;
  setQuery: (query: string) => void;
  setPosition: (position: { x: number; y: number }) => void;
  setSelectedIndex: (index: number) => void;
  setItems: (items: IntellisenseItem[]) => void;
  selectItem: (item: IntellisenseItem, onSelect: (item: IntellisenseItem) => void) => void;
  navigateUp: () => void;
  navigateDown: () => void;
}

export interface IntellisenseEvents {
  onKeyDown: (e: React.KeyboardEvent, onSelect: (item: IntellisenseItem) => void) => void;
  onItemClick: (item: IntellisenseItem, onSelect: (item: IntellisenseItem) => void) => void;
  onQueryChange: (query: string) => void;
}

export interface UseIntellisenseManagerReturn {
  intellisenseState: IntellisenseState;
  intellisenseActions: IntellisenseActions;
  intellisenseEvents: IntellisenseEvents;
}

/**
 * Hook specializzato per la gestione dell'intellisense
 * Gestisce: apertura/chiusura, query, posizione, navigazione, selezione
 */
export const useIntellisenseManager = (): UseIntellisenseManagerReturn => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [items, setItems] = useState<IntellisenseItem[]>([]);

  const intellisenseActions: IntellisenseActions = {
    openIntellisense: useCallback((newQuery: string, newPosition: { x: number; y: number }) => {
      setIsOpen(true);
      setQuery(newQuery);
      setPosition(newPosition);
      setSelectedIndex(0);
      console.log('🔍 [IntellisenseManager] Opened intellisense:', { query: newQuery, position: newPosition });
    }, []),

    closeIntellisense: useCallback(() => {
      setIsOpen(false);
      setQuery('');
      setSelectedIndex(0);
      setItems([]);
      console.log('🔍 [IntellisenseManager] Closed intellisense');
    }, []),

    setQuery: useCallback((newQuery: string) => {
      setQuery(newQuery);
      setSelectedIndex(0);
      console.log('🔍 [IntellisenseManager] Set query:', newQuery);
    }, []),

    setPosition: useCallback((newPosition: { x: number; y: number }) => {
      setPosition(newPosition);
      console.log('🔍 [IntellisenseManager] Set position:', newPosition);
    }, []),

    setSelectedIndex: useCallback((index: number) => {
      setSelectedIndex(index);
      console.log('🔍 [IntellisenseManager] Set selected index:', index);
    }, []),

    setItems: useCallback((newItems: IntellisenseItem[]) => {
      setItems(newItems);
      setSelectedIndex(0);
      console.log('🔍 [IntellisenseManager] Set items:', newItems.length);
    }, []),

    selectItem: useCallback((item: IntellisenseItem, onSelect: (item: IntellisenseItem) => void) => {
      console.log('🔍 [IntellisenseManager] Selected item:', item.name);
      onSelect(item);
      setIsOpen(false);
    }, []),

    navigateUp: useCallback(() => {
      setSelectedIndex(prev => Math.max(0, prev - 1));
      console.log('🔍 [IntellisenseManager] Navigated up');
    }, []),

    navigateDown: useCallback(() => {
      setSelectedIndex(prev => Math.min(items.length - 1, prev + 1));
      console.log('🔍 [IntellisenseManager] Navigated down');
    }, [items.length])
  };

  const intellisenseEvents: IntellisenseEvents = {
    onKeyDown: useCallback((e: React.KeyboardEvent, onSelect: (item: IntellisenseItem) => void) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          intellisenseActions.navigateUp();
          break;
        case 'ArrowDown':
          e.preventDefault();
          intellisenseActions.navigateDown();
          break;
        case 'Enter':
          e.preventDefault();
          if (items[selectedIndex]) {
            intellisenseActions.selectItem(items[selectedIndex], onSelect);
          }
          break;
        case 'Escape':
          e.preventDefault();
          intellisenseActions.closeIntellisense();
          break;
      }
    }, [isOpen, items, selectedIndex, intellisenseActions]),

    onItemClick: useCallback((item: IntellisenseItem, onSelect: (item: IntellisenseItem) => void) => {
      intellisenseActions.selectItem(item, onSelect);
    }, [intellisenseActions]),

    onQueryChange: useCallback((newQuery: string) => {
      intellisenseActions.setQuery(newQuery);
    }, [intellisenseActions])
  };

  const intellisenseState: IntellisenseState = {
    isOpen,
    query,
    position,
    selectedIndex,
    items
  };

  return {
    intellisenseState,
    intellisenseActions,
    intellisenseEvents
  };
};
