import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { IntellisenseResult, IntellisenseLayoutConfig } from './IntellisenseTypes';
import { IntellisenseItem } from './IntellisenseItem';
import { IntellisenseCategoryHeader } from './IntellisenseCategoryHeader';
import { CreateButtons } from './CreateButtons';
import { Plus, Bot, Database, CheckSquare, ChevronDown, Loader2, Megaphone, Ear, CheckCircle, GitBranch, FileText, Server } from 'lucide-react';

interface IntellisenseRendererProps {
  fuzzyResults: Map<string, IntellisenseResult[]>;
  semanticResults: IntellisenseResult[];
  selectedIndex: number;
  layoutConfig: IntellisenseLayoutConfig;
  categoryConfig: Record<string, { title: string; icon: React.ReactNode; color: string }>;
  onItemSelect: (result: IntellisenseResult) => void;
  onItemHover: (index: number) => void;
  onCreateNew?: (name: string, scope?: 'global' | 'industry') => void;
  onCreateAgentAct?: (name: string, scope?: 'global' | 'industry', categoryName?: string) => void;
  onCreateBackendCall?: (name: string, scope?: 'global' | 'industry', categoryName?: string) => void;
  onCreateTask?: (name: string, scope?: 'global' | 'industry', categoryName?: string) => void;
  query?: string;
  filterCategoryTypes?: string[];
  projectIndustry?: string;
  projectData?: any;
  allowCreatePicker?: boolean;
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
  projectIndustry = 'utility-gas',
  projectData,
  allowCreatePicker = false
}) => {
  // Debug logging removed to prevent excessive console output
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [creatingScope, setCreatingScope] = useState<'global' | 'industry' | null>(null);
  const [showCategorySelector, setShowCategorySelector] = useState<'global' | 'industry' | false>(false);
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Aggiungi uno stato per distinguere tra selezione da tastiera e da mouse
  const lastInputType = useRef<'keyboard' | 'mouse'>('keyboard');

  // Funzione per ottenere le categorie esistenti
  const getExistingCategories = (): string[] => {
    if (!projectData?.agentActs) return [];
    return projectData.agentActs.map((cat: any) => cat.name).filter(Boolean);
  };

  // Funzioni per gestire la selezione categoria
  const handleCategorySelect = (categoryName: string, scope: 'global' | 'industry') => {
    handleCreateAgentAct(query.trim(), scope, categoryName);
  };

  const handleCreateNewCategory = (scope: 'global' | 'industry') => {
    if (newCategoryName.trim()) {
      handleCreateAgentAct(query.trim(), scope, newCategoryName.trim());
    }
  };

  const handleCategoryInputKeyDown = (e: React.KeyboardEvent, scope: 'global' | 'industry') => {
    if (e.key === 'Enter') {
      handleCreateNewCategory(scope);
    } else if (e.key === 'Escape') {
      setShowCategoryInput(false);
      setNewCategoryName('');
    }
  };

  // Funzione generica per gestire la selezione delle entità
  const handleEntitySelect = (entityType: string, scope: 'global' | 'industry') => {
    switch (entityType) {
      case 'agentAct':
        handleCreateAgentAct(query.trim(), scope);
        break;
      case 'backendCall':
        handleCreateBackendCall(query.trim(), scope);
        break;
      case 'task':
        handleCreateTask(query.trim(), scope);
        break;
      default:
        console.error(`Unknown entity type: ${entityType}`);
    }
  };

  // Funzioni wrapper per gestire il loading durante la creazione
  const handleCreateAgentAct = (name: string, scope: 'global' | 'industry', categoryName?: string) => {
    setIsCreating(true);
    setCreatingScope(scope);
    try {
      onCreateAgentAct?.(name, scope, categoryName);
    } finally {
      // Reset immediato per creazione sincrona
      setTimeout(() => {
        setIsCreating(false);
        setCreatingScope(null);
        setShowCategorySelector(false);
        setShowCategoryInput(false);
        setNewCategoryName('');
      }, 100); // Piccolo delay per mostrare lo spinner
    }
  };

  const handleCreateBackendCall = (name: string, scope: 'global' | 'industry') => {
    setIsCreating(true);
    setCreatingScope(scope);
    try {
      onCreateBackendCall?.(name, scope);
    } finally {
      setTimeout(() => {
        setIsCreating(false);
        setCreatingScope(null);
      }, 100);
    }
  };

  const handleCreateTask = (name: string, scope: 'global' | 'industry') => {
    setIsCreating(true);
    setCreatingScope(scope);
    try {
      onCreateTask?.(name, scope);
    } finally {
      setTimeout(() => {
        setIsCreating(false);
        setCreatingScope(null);
      }, 100);
    }
  };

  const handleCreateNew = (name: string, scope: 'global' | 'industry') => {
    setIsCreating(true);
    setCreatingScope(scope);
    try {
      onCreateNew?.(name, scope);
    } finally {
      setTimeout(() => {
        setIsCreating(false);
        setCreatingScope(null);
      }, 100);
    }
  };

  // Calculate total items for layout decisions
  const totalFuzzyItems = Array.from(fuzzyResults.values()).reduce((sum, items) => sum + items.length, 0);
  const totalItems = totalFuzzyItems + semanticResults.length;
  
  // Per ora disabilitiamo il grid layout per semplificare la virtualizzazione
  const useGridLayout = false;
  
  // Filter categories if filterCategoryTypes is provided (allow unified 'intent' kind under 'conditions')
  const filteredFuzzy = new Map<string, IntellisenseResult[]>();
  fuzzyResults.forEach((categoryResults, categoryType) => {
    if (!filterCategoryTypes.length || filterCategoryTypes.includes(categoryType)) {
      filteredFuzzy.set(categoryType, categoryResults);
    }
  });

  // Flatten all results for index calculation
  const allResults: Array<{ result: IntellisenseResult; isFromAI: boolean; categoryType?: string }> = [];
  // Flat list: ignore categories entirely to avoid hiding matched items
  fuzzyResults.forEach(categoryResults => {
    categoryResults.forEach(result => { allResults.push({ result, isFromAI: false }); });
  });
  semanticResults.forEach(result => { allResults.push({ result, isFromAI: true }); });
  
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
    // Solo pulsanti: per i nodi mostra i tipi di Agent Act; per condizioni usa il flusso esistente
    const isForNodes = filterCategoryTypes.includes('agentActs') || filterCategoryTypes.includes('backendActions');
    const context = isForNodes ? 'nodes' : 'conditions';
    return (
      <div className="p-2">
        {query.trim() && isForNodes && allowCreatePicker ? (
          <div className="grid grid-cols-3 gap-2">
            {[{ key: 'Message', label: 'Message', Icon: Megaphone, color: '#34d399' }, { key: 'DataRequest', label: 'Data', Icon: Ear, color: '#3b82f6' }, { key: 'Confirmation', label: 'Confirmation', Icon: CheckCircle, color: '#6366f1' }, { key: 'ProblemClassification', label: 'Problem', Icon: GitBranch, color: '#f59e0b' }, { key: 'Summarizer', label: 'Summarizer', Icon: FileText, color: '#06b6d4' }, { key: 'BackendCall', label: 'BackendCall', Icon: Server, color: '#94a3b8' }].map(({ key, label, Icon, color }) => (
              <button
                key={key}
                className="px-4 py-2 border rounded-md bg-white hover:bg-slate-50 flex items-center gap-2 text-xs whitespace-nowrap"
                style={{ minWidth: 180 }}
                onClick={() => {
                  handleCreateAgentAct(query.trim(), 'industry');
                }}
              >
                <Icon className="w-4 h-4" style={{ color }} />
                <span className="text-slate-700">{label}</span>
              </button>
            ))}
          </div>
        ) : (query.trim() && !isForNodes && allowCreatePicker ? (
            <div className="flex justify-center mt-1">
              <CreateButtons
                context={context}
                query={query}
                projectIndustry={projectIndustry}
                isCreating={isCreating}
                creatingScope={creatingScope}
                onEntitySelect={handleEntitySelect}
                showCategorySelector={showCategorySelector}
                onCategorySelectorShow={setShowCategorySelector}
                onCreateNew={onCreateNew}
                existingCategories={getExistingCategories()}
                onCategorySelect={handleCategorySelect}
                showCategoryInput={showCategoryInput}
                newCategoryName={newCategoryName}
                onNewCategoryNameChange={setNewCategoryName}
                onCreateNewCategory={handleCreateNewCategory}
                onCategoryInputKeyDown={handleCategoryInputKeyDown}
              />
            </div>
          ) : null)}
      </div>
    );
  }

  
  // Render flat list without virtualization to avoid hiding matched items
  return (
    <div
      ref={containerRef}
      className={'overflow-auto'}
      onScroll={handleScroll}
      style={{
        maxHeight: layoutConfig.maxMenuHeight,
        maxWidth: layoutConfig.maxMenuWidth,
        overflowY: 'auto'
      }}
    >
      {allResults.map((item, index) => (
        <IntellisenseItem
          key={`${item.result.item.id}-${index}`}
          result={item.result}
          isSelected={selectedIndex === index}
          isFromAI={item.isFromAI}
          onClick={() => onItemSelect(item.result)}
          onMouseEnter={() => handleItemHover(index)}
        />
      ))}
    </div>
  );
};