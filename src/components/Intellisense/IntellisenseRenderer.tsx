import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { IntellisenseResult, IntellisenseLayoutConfig } from './IntellisenseTypes';
import { IntellisenseItem } from './IntellisenseItem';
import { IntellisenseCategoryHeader } from './IntellisenseCategoryHeader';
import { Plus, Bot, Database, CheckSquare, ChevronDown, Loader2 } from 'lucide-react';

interface IntellisenseRendererProps {
  fuzzyResults: Map<string, IntellisenseResult[]>;
  semanticResults: IntellisenseResult[];
  selectedIndex: number;
  layoutConfig: IntellisenseLayoutConfig;
  categoryConfig: Record<string, { title: string; icon: React.ReactNode; color: string }>;
  onItemSelect: (result: IntellisenseResult) => void;
  onItemHover: (index: number) => void;
  onCreateNew?: (name: string, scope?: 'global' | 'industry') => void;
  onCreateAgentAct?: (name: string, scope?: 'global' | 'industry') => void;
  onCreateBackendCall?: (name: string, scope?: 'global' | 'industry') => void;
  onCreateTask?: (name: string, scope?: 'global' | 'industry') => void;
  query?: string;
  filterCategoryTypes?: string[];
  projectIndustry?: string;
}

// Configurazione per la virtualizzazione
const ITEM_HEIGHT = 70; // Altezza approssimativa di ogni item
const VISIBLE_ITEMS = 8; // Numero di item visibili contemporaneamente
const BUFFER_SIZE = 2; // Item extra da renderizzare sopra/sotto per smoothness

export const IntellisenseRenderer: React.FC<IntellisenseRendererProps> = ({
  fuzzyResults,
  semanticResults,
  selectedIndex,
  layoutConfig,
  categoryConfig,
  onItemSelect,
  onItemHover,
  onCreateNew,
  onCreateAgentAct,
  onCreateBackendCall,
  onCreateTask,
  query = '',
  filterCategoryTypes = [],
  projectIndustry = 'utility-gas'
}) => {
  // Debug logging removed to prevent excessive console output
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [showCreateDropdown, setShowCreateDropdown] = useState<'global' | 'industry' | false>(false);
  const [isCreating, setIsCreating] = useState(false);
  const [creatingScope, setCreatingScope] = useState<'global' | 'industry' | null>(null);
  
  // Aggiungi uno stato per distinguere tra selezione da tastiera e da mouse
  const lastInputType = useRef<'keyboard' | 'mouse'>('keyboard');

  // Funzioni wrapper per gestire il loading durante la creazione
  const handleCreateAgentAct = async (name: string, scope: 'global' | 'industry') => {
    setIsCreating(true);
    setCreatingScope(scope);
    try {
      await onCreateAgentAct?.(name, scope);
    } finally {
      setIsCreating(false);
      setCreatingScope(null);
      setShowCreateDropdown(false);
    }
  };

  const handleCreateBackendCall = async (name: string, scope: 'global' | 'industry') => {
    setIsCreating(true);
    setCreatingScope(scope);
    try {
      await onCreateBackendCall?.(name, scope);
    } finally {
      setIsCreating(false);
      setCreatingScope(null);
      setShowCreateDropdown(false);
    }
  };

  const handleCreateTask = async (name: string, scope: 'global' | 'industry') => {
    setIsCreating(true);
    setCreatingScope(scope);
    try {
      await onCreateTask?.(name, scope);
    } finally {
      setIsCreating(false);
      setCreatingScope(null);
      setShowCreateDropdown(false);
    }
  };

  const handleCreateNew = async (name: string, scope: 'global' | 'industry') => {
    setIsCreating(true);
    setCreatingScope(scope);
    try {
      await onCreateNew?.(name, scope);
    } finally {
      setIsCreating(false);
      setCreatingScope(null);
      setShowCreateDropdown(false);
    }
  };

  // Calculate total items for layout decisions
  const totalFuzzyItems = Array.from(fuzzyResults.values()).reduce((sum, items) => sum + items.length, 0);
  const totalItems = totalFuzzyItems + semanticResults.length;
  
  // Per ora disabilitiamo il grid layout per semplificare la virtualizzazione
  const useGridLayout = false;
  
  // Flatten all results for index calculation
  const allResults: Array<{ result: IntellisenseResult; isFromAI: boolean; categoryType?: string }> = [];
  
  // Add fuzzy results by category
  fuzzyResults.forEach((categoryResults, categoryType) => {
    categoryResults.forEach(result => {
      allResults.push({ result, isFromAI: false, categoryType });
    });
  });
  
  // Add semantic results
  semanticResults.forEach(result => {
    allResults.push({ result, isFromAI: true });
  });
  
  // Calcola quali item sono visibili
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
  const endIndex = Math.min(allResults.length, startIndex + VISIBLE_ITEMS + (BUFFER_SIZE * 2));
  const visibleResults = allResults.slice(startIndex, endIndex);
  
  // Gestisci lo scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };
  
  // Modifica l'auto-scroll: solo se l'ultimo input è da tastiera
  useEffect(() => {
    if (containerRef.current && selectedIndex >= 0 && lastInputType.current === 'keyboard') {
      const selectedItemTop = selectedIndex * ITEM_HEIGHT;
      const containerHeight = VISIBLE_ITEMS * ITEM_HEIGHT;
      const currentScrollTop = containerRef.current.scrollTop;
      if (selectedItemTop < currentScrollTop) {
        containerRef.current.scrollTop = selectedItemTop;
      } else if (selectedItemTop >= currentScrollTop + containerHeight) {
        containerRef.current.scrollTop = selectedItemTop - containerHeight + ITEM_HEIGHT;
      }
    }
  }, [selectedIndex]);
  
  // Modifica onItemHover per segnalare input da mouse
  const handleItemHover = (index: number) => {
    lastInputType.current = 'mouse';
    onItemHover(index);
  };
  
  if (allResults.length === 0) {
    // Determina se è per nodi (agentActs/backendActions) o per condizioni
    const isForNodes = filterCategoryTypes.includes('agentActs') || filterCategoryTypes.includes('backendActions');
    
    return (
      <div className="p-4 text-gray-500">
        {/* Messaggio "Nessun risultato trovato" - sopra e a tutta larghezza */}
        <div className="text-center">
          <div className="text-sm text-slate-400">No results found.</div>
          <div className="text-xs mt-1 text-slate-500">
            Try with other words or press enter for search.
          </div>
          <div className="text-xs mt-2 text-slate-500">
            Or add <span className="font-bold text-white">"{query.trim()}"</span> to library:
          </div>
          
          {/* Pulsanti Create - dentro il messaggio */}
          {query.trim() && (
            <div className="flex justify-center mt-3">
              {isForNodes ? (
                // Toolbar con due pulsanti per nodi
                <div className="flex flex-col gap-1">
                  <div className="flex gap-2">
                    {/* Global */}
                    <div className="relative">
                      <button
                        onClick={() => setShowCreateDropdown('global')}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors whitespace-nowrap"
                        title="Crea elemento globale (cross-industry)"
                      >
                        {isCreating && creatingScope === 'global' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Plus className="w-3 h-3" />
                        )}
                        Global
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      
                      {showCreateDropdown === 'global' && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 min-w-[160px]">
                          <button
                            onClick={() => {
                              console.log('🎯 Create Global Agent Act clicked with query:', query.trim());
                              handleCreateAgentAct(query.trim(), 'global');
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-100 transition-colors"
                          >
                            <Bot className="w-3 h-3 text-green-500" />
                            Agent Act
                          </button>
                          <button
                            onClick={() => {
                              handleCreateBackendCall(query.trim(), 'global');
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-100 transition-colors"
                          >
                            <Database className="w-3 h-3 text-blue-500" />
                            Backend Call
                          </button>
                          <button
                            onClick={() => {
                              handleCreateTask(query.trim(), 'global');
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-100 transition-colors"
                          >
                            <CheckSquare className="w-3 h-3 text-orange-500" />
                            Task
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Industry */}
                    <div className="relative">
                      <button
                        onClick={() => setShowCreateDropdown('industry')}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors whitespace-nowrap"
                        title={`Crea elemento per ${projectIndustry}`}
                      >
                        {isCreating && creatingScope === 'industry' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Plus className="w-3 h-3" />
                        )}
                        {projectIndustry}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      
                      {showCreateDropdown === 'industry' && (
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 min-w-[160px]">
                          <button
                            onClick={() => {
                              console.log('🎯 Create Industry Agent Act clicked with query:', query.trim());
                              handleCreateAgentAct(query.trim(), 'industry');
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-100 transition-colors"
                          >
                            <Bot className="w-3 h-3 text-green-500" />
                            Agent Act
                          </button>
                          <button
                            onClick={() => {
                              handleCreateBackendCall(query.trim(), 'industry');
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-100 transition-colors"
                          >
                            <Database className="w-3 h-3 text-blue-500" />
                            Backend Call
                          </button>
                          <button
                            onClick={() => {
                              handleCreateTask(query.trim(), 'industry');
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-100 transition-colors"
                          >
                            <CheckSquare className="w-3 h-3 text-orange-500" />
                            Task
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                // Toolbar con due pulsanti per condizioni
                onCreateNew && (
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-2">
                      {/* Global Condition */}
                      <div className="relative">
                        <button
                          onClick={() => setShowCreateDropdown('global')}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors whitespace-nowrap"
                          title="Crea condizione globale (cross-industry)"
                        >
                          {isCreating && creatingScope === 'global' ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Plus className="w-3 h-3" />
                          )}
                          Global
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        
                        {showCreateDropdown === 'global' && (
                          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 min-w-[160px]">
                            <button
                              onClick={() => {
                                console.log('🎯 Create Global Condition clicked with query:', query.trim());
                                handleCreateNew(query.trim(), 'global');
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-100 transition-colors"
                            >
                              <CheckSquare className="w-3 h-3 text-green-500" />
                              Condition
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Industry Condition */}
                      <div className="relative">
                        <button
                          onClick={() => setShowCreateDropdown('industry')}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors whitespace-nowrap"
                          title={`Crea condizione per ${projectIndustry}`}
                        >
                          {isCreating && creatingScope === 'industry' ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Plus className="w-3 h-3" />
                          )}
                          {projectIndustry}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        
                        {showCreateDropdown === 'industry' && (
                          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 min-w-[160px]">
                            <button
                              onClick={() => {
                                console.log('🎯 Create Industry Condition clicked with query:', query.trim());
                                handleCreateNew(query.trim(), 'industry');
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-100 transition-colors"
                            >
                              <CheckSquare className="w-3 h-3 text-blue-500" />
                              Condition
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
  
  const smallSet = totalItems <= 2;
  return (
    <div 
      ref={containerRef}
      className={smallSet ? '' : 'overflow-auto'}
      onScroll={handleScroll}
      style={{ 
        maxHeight: smallSet ? undefined : layoutConfig.maxMenuHeight,
        maxWidth: layoutConfig.maxMenuWidth,
        height: smallSet ? (totalItems * ITEM_HEIGHT) : Math.min(totalItems * ITEM_HEIGHT, layoutConfig.maxMenuHeight),
        overflow: smallSet ? 'visible' : undefined
      }}
    >
      {/* Spazio virtuale sopra: disattivato per liste piccole */}
      {!smallSet && <div style={{ height: startIndex * ITEM_HEIGHT }} />}
      
      {/* Renderizza solo gli item visibili */}
      {visibleResults.map((item, index) => {
        const globalIndex = startIndex + index;
        return (
          <IntellisenseItem
            key={`${item.result.item.id}-${globalIndex}`}
            result={item.result}
            isSelected={selectedIndex === globalIndex}
            isFromAI={item.isFromAI}
            onClick={() => onItemSelect(item.result)}
            onMouseEnter={() => handleItemHover(globalIndex)}
          />
        );
      })}
      
      {/* Spazio virtuale sotto: disattivato per liste piccole */}
      {!smallSet && <div style={{ height: (totalItems - endIndex) * ITEM_HEIGHT }} />}
    </div>
  );
};