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
import { SIDEBAR_TYPE_ICONS, SIDEBAR_ICON_COMPONENTS, SIDEBAR_TYPE_COLORS } from '../Sidebar/sidebarTheme';

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
  onCreateNew?: (name: string, scope?: 'global' | 'industry') => void;
  onCreateAgentAct?: (name: string, scope?: 'global' | 'industry', categoryName?: string) => void;
  onCreateBackendCall?: (name: string, scope?: 'global' | 'industry', categoryName?: string) => void;
  onCreateTask?: (name: string, scope?: 'global' | 'industry', categoryName?: string) => void;
}

export const IntellisenseMenu: React.FC<IntellisenseMenuProps> = ({
  isOpen,
  query,
  position,
  referenceElement,
  onSelect,
  onClose,
  filterCategoryTypes,
  onCreateNew,
  onCreateAgentAct,
  onCreateBackendCall,
  onCreateTask
}) => {
  // Debug logging removed to prevent excessive console output
  const { data } = useProjectData();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [fuzzyResults, setFuzzyResults] = useState<Map<string, IntellisenseResult[]>>(new Map());
  const [semanticResults, setSemanticResults] = useState<IntellisenseResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [allIntellisenseItems, setAllIntellisenseItems] = useState<IntellisenseItem[]>([]);
  const defaultCats = ['agentActs', 'userActs', 'backendActions', 'tasks'];
  const [activeCats, setActiveCats] = useState<string[]>(filterCategoryTypes && filterCategoryTypes.length ? filterCategoryTypes : defaultCats);

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
      
      // Altezza desiderata: più generosa per 1-2 risultati (per vedere payoff senza scroll)
      // Se non ci sono risultati ma c'è una query, calcola l'altezza per messaggio + pulsanti + 5px sotto
      const desiredHeight = totalItems === 0 && query.trim()
        ? 140 // Altezza precisa: 16px padding top + 60px messaggio + 40px pulsanti + 19px padding bottom (5px sotto i pulsanti)
        : totalItems <= 2
          ? Math.min(defaultLayoutConfig.itemHeight * totalItems + 72, defaultLayoutConfig.maxMenuHeight)
          : Math.min(totalItems * 70 + 60, defaultLayoutConfig.maxMenuHeight);

      // Calcola spazio disponibile sopra e sotto
      const spaceBelow = viewportHeight - rect.bottom - 10; // 10px di margine
      const spaceAbove = rect.top - 10; // 10px di margine
      
      let top;
      let maxHeight;
      
      if (spaceBelow >= desiredHeight || spaceBelow >= spaceAbove) {
        // Posiziona sotto
        top = rect.bottom + 5;
        maxHeight = Math.min(desiredHeight, spaceBelow - 5);
      } else {
        // Posiziona sopra
        maxHeight = Math.min(desiredHeight, spaceAbove - 5);
        top = rect.top - maxHeight - 5;
      }
      
      // Assicurati che il menu non vada mai fuori dalla viewport
      top = Math.max(10, Math.min(top, viewportHeight - maxHeight - 10));
      
      let left = rect.left;

      // Aggiusta se il menu esce dallo schermo orizzontalmente
      if (left + menuWidth > viewportWidth) {
        left = viewportWidth - menuWidth - 10;
      }

      const finalHeight = Math.min(maxHeight, desiredHeight);

      setMenuStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${menuWidth}px`,
        maxHeight: `${maxHeight}px`,
        minHeight: `${finalHeight}px`,
        height: totalItems <= 2 ? `${finalHeight}px` : undefined,
        overflowY: totalItems <= 2 ? 'visible' : 'auto',
        zIndex: 9999
      });
    };

    updatePosition();

    // Update position on resize/scroll
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    // Also observe the reference element for size changes (e.g., textarea auto-grow)
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(() => updatePosition());
      ro.observe(referenceElement);
    } catch {}

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      try { ro && ro.disconnect(); } catch {}
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

  // Initialize / refresh fuzzy search when data or activeCats change
  useEffect(() => {
    if (!data) return;
    let intellisenseData = prepareIntellisenseData(data);
    if (activeCats && activeCats.length > 0) {
      intellisenseData = intellisenseData.filter(item => activeCats.includes(item.categoryType));
    }
    initializeFuzzySearch(intellisenseData);
    setAllIntellisenseItems(intellisenseData);
    setIsInitialized(true);
    // Immediately compute results for current query so new items appear right away
    if (!query.trim()) {
      const allResults: IntellisenseResult[] = intellisenseData.map(item => ({ item } as IntellisenseResult));
      setFuzzyResults(groupAndSortResults(allResults));
      setSemanticResults([]);
      setSelectedIndex(0);
    } else {
      const fres = performFuzzySearch(query, intellisenseData);
      setFuzzyResults(groupAndSortResults(fres));
      setSemanticResults([]);
      setSelectedIndex(0);
    }
  }, [data, activeCats, query, isOpen]);

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
        // Lasciare max/min/overflow a menuStyle per usare il calcolo dinamico sopra
      }}
      className="bg-white rounded-lg shadow-xl border border-gray-300"
    >
      {/* Compact header: only category filter bar (no result/hints text) */}
      {totalItems > 0 && (
        <div className="px-3 py-2 border-b border-slate-700 bg-slate-900 rounded-t-lg">
          {/* Category filter bar */}
          <div className="mt-2 flex items-center gap-2">
          {[
            { key: 'agentActs', iconKey: SIDEBAR_TYPE_ICONS.agentActs, label: 'Agent' },
            { key: 'userActs', iconKey: SIDEBAR_TYPE_ICONS.userActs, label: 'User' },
            { key: 'backendActions', iconKey: SIDEBAR_TYPE_ICONS.backendActions, label: 'Backend' },
            { key: 'tasks', iconKey: SIDEBAR_TYPE_ICONS.tasks, label: 'Tasks' },
          ].map(({ key, iconKey, label }) => {
            const active = activeCats.includes(key);
            const Icon = SIDEBAR_ICON_COMPONENTS[iconKey];
            const col = (SIDEBAR_TYPE_COLORS as Record<string, { color: string }>)[key]?.color || '#e5e7eb';
            return (
              <button
                key={key}
                onClick={(e) => { e.stopPropagation(); setActiveCats(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]); }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] border"
                style={{
                  background: active ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)',
                  color: col,
                  borderColor: active ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)'
                }}
                title={`Toggle ${label}`}
              >
                {Icon ? <Icon className="w-3 h-3" style={{ color: col }} /> : null}
                {label}
              </button>
            );
          })}
          {isLoading && (
            <span className="ml-auto flex items-center text-[10px] text-slate-300">
              <div className="animate-spin w-3 h-3 border border-slate-400 border-t-transparent rounded-full mr-2"></div>
              AI…
            </span>
          )}
        </div>
        </div>
      )}

      {/* Results */}
      <IntellisenseRenderer
        fuzzyResults={fuzzyResults}
        semanticResults={semanticResults}
        selectedIndex={selectedIndex}
        layoutConfig={defaultLayoutConfig}
        categoryConfig={{}}
        onItemSelect={(result) => onSelect(result.item)}
        onItemHover={(index) => setSelectedIndex(index)}
        onCreateNew={onCreateNew}
        onCreateAgentAct={onCreateAgentAct}
        onCreateBackendCall={onCreateBackendCall}
        onCreateTask={onCreateTask}
        query={query}
        filterCategoryTypes={filterCategoryTypes}
        projectIndustry={data?.industry}
        projectData={data}
      />
    </div>
  );
};