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
  allowCreatePicker?: boolean;
  // Optional seed items to inject into the dataset (e.g., Problem intents from source node)
  seedItems?: IntellisenseItem[];
  // Unified item list (conditions + intents) already prepared by caller. If provided, overrides project data.
  extraItems?: IntellisenseItem[];
  allowedKinds?: Array<'condition' | 'intent'>;
}

export const IntellisenseMenu: React.FC<IntellisenseMenuProps & { inlineAnchor?: boolean; navSignal?: { seq: number; dir: 1 | -1 }; onEnterSelected?: (item: IntellisenseItem | null) => void }> = ({
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
  onCreateTask,
  allowCreatePicker = false,
  seedItems,
  extraItems,
  allowedKinds,
  inlineAnchor = false,
  navSignal,
  onEnterSelected
}) => {
  const ErrorBoundary = React.useMemo(() => (
    class EB extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
      constructor(props: any) { super(props); this.state = { hasError: false }; }
      static getDerivedStateFromError() { return { hasError: true }; }
      componentDidCatch(err: any) { try { console.warn('[IntellisenseMenu][ErrorBoundary]', err); } catch { } }
      render() { return (this.state as any).hasError ? null : (this.props as any).children; }
    }
  ), []);
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
  // Include 'conditions' by default so condition items are not filtered out
  const defaultCats = ['agentActs', 'userActs', 'backendActions', 'conditions', 'tasks'];
  const [activeCats, setActiveCats] = useState<string[]>(filterCategoryTypes && filterCategoryTypes.length ? filterCategoryTypes : defaultCats);
  const loggedThisOpenRef = useRef(false);

  // Remove noisy logs: keep hook for future metrics if needed
  useEffect(() => {
    // no-op: metrics disabled
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

      const style: any = {
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${menuWidth}px`,
        maxHeight: `${maxHeight}px`,
        zIndex: 9999
      };
      if (totalItems > 0) {
        style.minHeight = `${finalHeight}px`;
        style.height = totalItems <= 2 ? `${finalHeight}px` : undefined;
        style.overflowY = totalItems <= 2 ? 'visible' : 'auto';
      } else {
        // Nessun risultato: lascia che l'altezza si adatti al contenuto (no rettangolo vuoto)
        style.overflowY = 'visible';
      }

      setMenuStyle(style);
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
    } catch { }

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      try { ro && ro.disconnect(); } catch { }
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
    // Build dataset as UNION: [extraItems (if any)] + [project data] + [seedItems]
    let intellisenseData: IntellisenseItem[] = [];
    const usingExtra = Array.isArray(extraItems) && extraItems.length > 0;
    const baseFromProject = data ? prepareIntellisenseData(data) : [] as IntellisenseItem[];

    if (usingExtra) {
      intellisenseData = [...(extraItems as IntellisenseItem[]), ...baseFromProject];
    } else {
      intellisenseData = baseFromProject;
    }
    if (Array.isArray(seedItems) && seedItems.length) {
      intellisenseData = [...intellisenseData, ...seedItems];
    }

    // Applica filtri SOLO se richiesti dai chiamanti
    if (Array.isArray(filterCategoryTypes) && filterCategoryTypes.length) {
      intellisenseData = intellisenseData.filter(item => filterCategoryTypes.includes((item as any)?.categoryType));
    }
    if (Array.isArray(allowedKinds) && allowedKinds.length) {
      intellisenseData = intellisenseData.filter(item => {
        const kind = (item as any)?.kind as any;
        if (kind) return allowedKinds.includes(kind);
        // condizioni spesso non hanno kind esplicito
        if ((item as any)?.categoryType === 'conditions' && allowedKinds.includes('condition' as any)) return true;
        return false;
      });
    }
    initializeFuzzySearch(intellisenseData);
    setAllIntellisenseItems(intellisenseData);
    setIsInitialized(true);
    // Immediately compute results for current query so new items appear right away
    if (!query.trim()) {
      // Show the full dataset
      const baseItems = intellisenseData;
      const allResults: IntellisenseResult[] = baseItems.map(item => ({ item } as IntellisenseResult));
      // Flat category: avoid any category-based filtering downstream
      const flat = new Map<string, IntellisenseResult[]>();
      flat.set('conditions', allResults);
      setFuzzyResults(flat);
      setSemanticResults([]);
      setSelectedIndex(0);
    } else {
      const fres = performFuzzySearch(query, intellisenseData);
      const flat = new Map<string, IntellisenseResult[]>();
      flat.set('conditions', fres);
      setFuzzyResults(flat);
      setSemanticResults([]);
      // non resettare selectedIndex se già valido
      const total = fres.length;
      setSelectedIndex((prev) => (prev >= 0 && prev < total ? prev : 0));
    }
  }, [data, activeCats, query, isOpen, seedItems, extraItems, allowedKinds]);

  // Rimuovi i log dataset (troppo rumorosi)
  useEffect(() => { if (!isOpen) loggedThisOpenRef.current = false; }, [isOpen]);

  // Perform search when query changes
  useEffect(() => {
    if (!isInitialized) return;
    const qlen = (query || '').trim().length;

    // Se la query è corta (<2), non mostrare nulla
    if (qlen < 2) {
      setFuzzyResults(new Map());
      setSemanticResults([]);
      return;
    }

    // Esegui solo la ricerca fuzzy quando la query cambia
    const results = performFuzzySearch(query, allIntellisenseItems);
    const flat = new Map<string, IntellisenseResult[]>();
    flat.set('conditions', results);
    setFuzzyResults(flat);
    setSemanticResults([]); // Reset semantic results
    // mantieni selezione se possibile
    const total = results.length;
    setSelectedIndex((prev) => (prev >= 0 && prev < total ? prev : 0));

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

  // Snapshot del selezionato corrente (deterministico su Enter)
  const lastSelectedRef = useRef<IntellisenseItem | null>(null);
  useEffect(() => {
    const all = getAllResults();
    lastSelectedRef.current = all[selectedIndex]?.item || null;
  }, [selectedIndex, fuzzyResults, semanticResults]);

  // Ensure selectedIndex is within bounds when results change
  useEffect(() => {
    const total = Array.from(fuzzyResults.values()).reduce((s, arr) => s + arr.length, 0) + semanticResults.length;
    if (selectedIndex >= total) setSelectedIndex(total > 0 ? total - 1 : 0);
  }, [fuzzyResults, semanticResults, selectedIndex]);

  // Host-driven navigation (clean integration from parent input)
  const lastNavSeqRef = useRef<number>(-1);
  const suppressHoverUntilRef = useRef<number>(0);
  useEffect(() => {
    if (!isOpen) return;
    const total = Array.from(fuzzyResults.values()).reduce((s, arr) => s + arr.length, 0) + semanticResults.length;
    if (!navSignal || typeof navSignal.seq !== 'number' || navSignal.seq === lastNavSeqRef.current || total === 0) return;
    lastNavSeqRef.current = navSignal.seq;
    let idx = selectedIndex + (navSignal.dir > 0 ? 1 : -1);
    if (idx < 0) idx = total - 1; else if (idx >= total) idx = 0;
    try { console.log('[Intellisense][nav]', { from: selectedIndex, to: idx, total, nav: navSignal }); } catch { }
    setSelectedIndex(idx);
    // Suppress hover selection for a brief window to avoid flicker
    suppressHoverUntilRef.current = Date.now() + 200;
    // Scroll the newly selected item into view
    try {
      const container = menuRef.current as HTMLElement | null;
      if (container) {
        const items = container.querySelectorAll('[data-intellisense-item]');
        const el = items[idx] as HTMLElement | undefined;
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'nearest' });
        }
      }
    } catch { }
  }, [navSignal, isOpen, fuzzyResults, semanticResults, selectedIndex]);

  // Log selection changes (diagnostic)
  useEffect(() => {
    try { console.log('[Intellisense][selectedIndex]', selectedIndex); } catch { }
  }, [selectedIndex]);

  // Debug UI flag: render matched labels directly in the menu (no console needed)
  const debugIntellisenseUi = (() => { try { return localStorage.getItem('debug.intellisense.ui') === '1'; } catch { return false; } })();

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
          // Conferma usando lo snapshot per evitare ricalcoli durante l'enter
          const snap = lastSelectedRef.current;
          if (snap) {
            if (onEnterSelected) onEnterSelected(snap);
            else onSelect(snap);
            return;
          }
          // notify parent (inline) solo se non c'è selezionato
          try { document.dispatchEvent(new CustomEvent('intelli-enter')); } catch { }
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
          const sel = allResults[selectedIndex]?.item || null;
          if (sel) {
            if (onEnterSelected) onEnterSelected(sel);
            else onSelect(sel);
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

    // Solo se non ancorato a input inline: altrimenti gestisce il parent
    if (!inlineAnchor) {
      document.addEventListener('keydown', handleKeyDown, true);
    }
    // Also listen to custom navigation events from host inputs
    const onNav = (e: any) => {
      const dir = e?.detail?.dir as number | undefined;
      if (!dir || totalItems === 0) return;
      let idx = selectedIndex + (dir > 0 ? 1 : -1);
      if (idx < 0) idx = totalItems - 1; else if (idx >= totalItems) idx = 0;
      setSelectedIndex(idx);
    };
    document.addEventListener('intelli-nav', onNav as any, true);
    const onEnter = () => {
      const sel = lastSelectedRef.current;
      if (sel) {
        if (onEnterSelected) onEnterSelected(sel);
        else onSelect(sel);
      }
    };
    document.addEventListener('intelli-enter', onEnter as any, true);
    return () => {
      if (!inlineAnchor) document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('intelli-nav', onNav as any, true);
      document.removeEventListener('intelli-enter', onEnter as any, true);
    };
  }, [isOpen, selectedIndex, totalItems, fuzzyResults, semanticResults, onSelect, onClose, query, allIntellisenseItems, inlineAnchor]);

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

  // Log menu rendering details
  useEffect(() => {
    if (isOpen) {
      console.log('🔍 [INTELLISENSE_RENDER] Menu opened at position:', {
        x: position?.x,
        y: position?.y,
        reference: referenceElement?.tagName
      });
    }
  }, [isOpen]); // Solo isOpen come dipendenza

  if (!isOpen || !isInitialized) {
    return null;
  }

  // If no results, still render the shell to avoid blink/hide issues during updates
  const noResults = totalItems === 0;

  return (
    <ErrorBoundary>
      <div
        ref={menuRef}
        style={inlineAnchor ? {
          position: 'absolute',
          top: 0,
          left: 0,
          background: '#fff',
          color: '#111',
          border: '1px solid #d1d5db',
          boxShadow: '0 4px 24px rgba(30,41,59,0.10)',
          borderRadius: 12,
          padding: 0,
          width: 320,
          maxHeight: 320,
          overflowY: 'auto',
          zIndex: 9999
        } : {
          ...menuStyle,
          background: '#fff',
          color: '#111',
          border: '1px solid #d1d5db', // gray-300
          boxShadow: '0 4px 24px 0 rgba(30,41,59,0.10)',
          borderRadius: 12,
          padding: 0,
          width: 320,
          maxHeight: 320,
          overflowY: 'auto',
          zIndex: 99999,
          position: 'fixed',
          top: position?.y || 0,
          left: position?.x || 0
        }}
        className="bg-white rounded-lg shadow-xl border border-gray-300"
        onMouseEnter={() => console.log('🔍 [INTELLISENSE_MOUSE_ENTER] Menu mouse enter')}
        onMouseLeave={() => console.log('🔍 [INTELLISENSE_MOUSE_LEAVE] Menu mouse leave')}
      >
        {/* Compact header: only category filter bar (no result/hints text) */}
        {false && totalItems > 0 && (
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
          onItemHover={(index) => {
            if (Date.now() < suppressHoverUntilRef.current) return;
            setSelectedIndex(index);
          }}
          onCreateNew={onCreateNew}
          onCreateAgentAct={onCreateAgentAct}
          onCreateBackendCall={onCreateBackendCall}
          onCreateTask={onCreateTask}
          query={query}
          filterCategoryTypes={[...new Set(['conditions', ...(filterCategoryTypes || [])])]}
          projectIndustry={data?.industry}
          projectData={data}
          allowCreatePicker={allowCreatePicker}
        />

        {debugIntellisenseUi && null}
      </div>
    </ErrorBoundary>
  );
};