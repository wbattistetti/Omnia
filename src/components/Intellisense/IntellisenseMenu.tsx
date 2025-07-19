import React, { useState, useEffect, useRef } from 'react';
import { IntellisenseRenderer } from './IntellisenseRenderer';
import {  
  groupAndSortResults,
  initializeFuzzySearch,
  performFuzzySearch,
  performSemanticSearch
} from './IntellisenseSearch';
import { IntellisenseItem, IntellisenseResult, IntellisenseLayoutConfig } from './IntellisenseTypes';
import { useProjectData } from '../../context/ProjectDataContext';
import { prepareIntellisenseData } from '../../services/ProjectDataService';
import { SIDEBAR_TYPE_ICONS } from '../Sidebar/sidebarTheme';

const defaultLayoutConfig: IntellisenseLayoutConfig = {
  maxVisibleItems: 12,
  itemHeight: 60,
  categoryHeaderHeight: 40,
  maxMenuHeight: 400,
  maxMenuWidth: 320
};

interface IntellisenseMenuProps {
  isOpen: boolean;
  query: string;
  position: { x: number; y: number };
  referenceElement: HTMLElement | null;
  onSelect: (item: IntellisenseItem) => void;
  onClose: () => void;
  filterCategoryTypes?: string[];
}

export const IntellisenseMenu: React.FC<IntellisenseMenuProps> = ({
  isOpen,
  query,
  position,
  referenceElement,
  onSelect,
  onClose,
  filterCategoryTypes
}) => {
  const { data } = useProjectData();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [fuzzyResults, setFuzzyResults] = useState<Map<string, IntellisenseResult[]>>(new Map());
  const [semanticResults, setSemanticResults] = useState<IntellisenseResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [allIntellisenseItems, setAllIntellisenseItems] = useState<IntellisenseItem[]>([]);

  // LOG DATI INTELLISENSE
  useEffect(() => {
    // Calcola il numero totale di risultati fuzzy
    const fuzzyCount = Array.from(fuzzyResults.values()).reduce((sum, arr) => sum + arr.length, 0);
  }, [allIntellisenseItems, query, fuzzyResults, semanticResults]);

  // Calculate total items for navigation
  const totalItems = Array.from(fuzzyResults.values()).reduce((sum, items) => sum + items.length, 0) + semanticResults.length;

  // Calculate menu position
  useEffect(() => {
    if (!isOpen || !referenceElement) return;

    const updatePosition = () => {
      const rect = referenceElement.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const menuWidth = 320;
      
      // Calcola l'altezza stimata del menu basata sui risultati
      const estimatedMenuHeight = Math.min(
        totalItems * 70 + 60, // 70px per item + 60px per header e padding
        defaultLayoutConfig.maxMenuHeight
      );

      // Calcola spazio disponibile sopra e sotto
      const spaceBelow = viewportHeight - rect.bottom - 10; // 10px di margine
      const spaceAbove = rect.top - 10; // 10px di margine
      
      let top;
      let maxHeight;
      
      if (spaceBelow >= estimatedMenuHeight || spaceBelow >= spaceAbove) {
        // Posiziona sotto
        top = rect.bottom + 5;
        maxHeight = Math.min(estimatedMenuHeight, spaceBelow - 5);
      } else {
        // Posiziona sopra
        maxHeight = Math.min(estimatedMenuHeight, spaceAbove - 5);
        top = rect.top - maxHeight - 5;
      }
      
      // Assicurati che il menu non vada mai fuori dalla viewport
      top = Math.max(10, Math.min(top, viewportHeight - maxHeight - 10));
      
      let left = rect.left;

      // Aggiusta se il menu esce dallo schermo orizzontalmente
      if (left + menuWidth > viewportWidth) {
        left = viewportWidth - menuWidth - 10;
      }

      setMenuStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${menuWidth}px`,
        maxHeight: `${maxHeight}px`,
        overflowY: 'auto',
        zIndex: 9999
      });
    };

    updatePosition();

    // Update position on resize/scroll
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, referenceElement, totalItems]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current && 
        !menuRef.current.contains(target) &&
        referenceElement &&
        !referenceElement.contains(target)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, referenceElement]);

  // Initialize fuzzy search when data is available
  useEffect(() => {
    if (data && !isInitialized) {
      let intellisenseData = prepareIntellisenseData(data); // categoryConfig non serve più
      
      // Filter by category types if specified
      if (filterCategoryTypes && filterCategoryTypes.length > 0) {
        intellisenseData = intellisenseData.filter(item => 
          filterCategoryTypes.includes(item.categoryType)
        );
      }
      
      initializeFuzzySearch(intellisenseData);
      setAllIntellisenseItems(intellisenseData);
      setIsInitialized(true);
    }
  }, [data, isInitialized, filterCategoryTypes]);

  // Perform search when query changes
  useEffect(() => {
    if (!isInitialized) return;

    // Se la query è vuota, mostra tutte le voci disponibili
    if (!query.trim()) {
      const allResults: IntellisenseResult[] = allIntellisenseItems.map(item => ({
        item
      }));
      
      const groupedResults = groupAndSortResults(allResults);
      setFuzzyResults(groupedResults);
      setSemanticResults([]);
      return;
    }

    // Esegui solo la ricerca fuzzy quando la query cambia
    const fuzzyResults = performFuzzySearch(query);
    const groupedFuzzy = groupAndSortResults(fuzzyResults);
    
    setFuzzyResults(groupedFuzzy);
    setSemanticResults([]); // Reset semantic results
    setSelectedIndex(0);
    
    // Dopo aver ottenuto fuzzyResults
  }, [query, isInitialized, allIntellisenseItems]);

  // Get all results in order for navigation
  const getAllResults = (): IntellisenseResult[] => {
    const allResults: IntellisenseResult[] = [];
    fuzzyResults.forEach(categoryResults => {
      allResults.push(...categoryResults);
    });
    allResults.push(...semanticResults);
    return allResults;
  };

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      
      let newSelectedIndex = selectedIndex;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          newSelectedIndex = (selectedIndex + 1) % totalItems;
          break;
        case 'ArrowUp':
          e.preventDefault();
          newSelectedIndex = (selectedIndex - 1 + totalItems) % totalItems;
          break;
        case 'Enter':
          e.preventDefault();
          // If no fuzzy results and we have a query, trigger semantic search
          if (totalItems === 0 && query.trim() && allIntellisenseItems.length > 0) {
            const performSemanticOnly = async () => {
              setIsLoading(true);
              try {
                const semanticResults = await performSemanticSearch(query, allIntellisenseItems);
                setSemanticResults(semanticResults);
                setSelectedIndex(0);
              } catch (error) {
                // console.error('Semantic search error:', error);
              } finally {
                setIsLoading(false);
              }
            };
            performSemanticOnly();
            return;
          }
          
          const allResults = getAllResults();
          if (allResults[selectedIndex]) {
            onSelect(allResults[selectedIndex].item);
          } else {
            // console.log('❌ IntellisenseMenu - Nessun elemento selezionabile all\'indice:', selectedIndex);
          }
          return;
        case 'Escape':
          e.preventDefault();
          onClose();
          return;
      }

      if (newSelectedIndex >= 0 && newSelectedIndex < totalItems) {
        setSelectedIndex(newSelectedIndex);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, totalItems, fuzzyResults, semanticResults, onSelect, onClose, query, allIntellisenseItems]);

  // Auto-scroll to keep selected item visible
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const selectedElement = menuRef.current.querySelector('.bg-purple-100');
    if (!selectedElement) return;

    const scrollContainer = menuRef.current.querySelector('.overflow-auto') || menuRef.current;
    const containerRect = scrollContainer.getBoundingClientRect();
    const selectedRect = selectedElement.getBoundingClientRect();
    
    const isAboveView = selectedRect.top < containerRect.top;
    const isBelowView = selectedRect.bottom > containerRect.bottom;

    if (isAboveView || isBelowView) {
      const selectedElementTop = (selectedElement as HTMLElement).offsetTop;
      const containerHeight = scrollContainer.clientHeight;
      const selectedElementHeight = selectedElement.clientHeight;

      let newScrollTop;
      
      if (isAboveView) {
        newScrollTop = selectedElementTop;
      } else {
        newScrollTop = selectedElementTop - containerHeight + selectedElementHeight;
      }

      scrollContainer.scrollTo({
        top: newScrollTop,
        behavior: 'smooth'
      });
    }
  }, [selectedIndex, isOpen]);

  if (!isOpen || !isInitialized) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      style={{
        ...menuStyle,
        background: '#fff',
        border: '1px solid #d1d5db', // gray-300
        boxShadow: '0 4px 24px 0 rgba(30,41,59,0.10)',
        borderRadius: 12,
        padding: 0,
        maxHeight: `${Math.min(totalItems, 8) * 56 + 48}px`, // 56px per item + header
        overflowY: totalItems > 8 ? 'auto' : 'visible',
        minHeight: 0,
      }}
      className="bg-white rounded-lg shadow-xl border border-gray-300 overflow-hidden"
    >
      {/* Search indicator */}
      <div className="px-3 py-2 border-b border-slate-700 bg-slate-900 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="text-xs text-white">
            {isLoading ? (
              <span className="flex items-center">
                <div className="animate-spin w-3 h-3 border border-slate-400 border-t-transparent rounded-full mr-2"></div>
                {totalItems === 0 ? 'Ricerca semantica in corso...' : 'Ricerca in corso...'}
              </span>
            ) : (
              <span>
                {totalItems} risultat{totalItems !== 1 ? 'i' : 'o'} per "{query}"
                {semanticResults.length > 0 && <span className="ml-2 text-slate-300">(+ AI)</span>}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400">
            ↑↓ naviga • Enter {totalItems === 0 ? 'ricerca AI' : 'seleziona'} • Esc chiudi
          </div>
        </div>
      </div>

      {/* Results */}
      <IntellisenseRenderer
        fuzzyResults={fuzzyResults}
        semanticResults={semanticResults}
        selectedIndex={selectedIndex}
        layoutConfig={defaultLayoutConfig}
        onItemSelect={(result) => onSelect(result.item)}
        onItemHover={(result) => setSelectedIndex(result.index)}
      />
    </div>
  );
};