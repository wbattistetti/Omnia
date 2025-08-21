import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { IntellisenseResult, IntellisenseLayoutConfig } from './IntellisenseTypes';
import { IntellisenseItem } from './IntellisenseItem';
import { IntellisenseCategoryHeader } from './IntellisenseCategoryHeader';

interface IntellisenseRendererProps {
  fuzzyResults: Map<string, IntellisenseResult[]>;
  semanticResults: IntellisenseResult[];
  selectedIndex: number;
  layoutConfig: IntellisenseLayoutConfig;
  categoryConfig: Record<string, { title: string; icon: React.ReactNode; color: string }>;
  onItemSelect: (result: IntellisenseResult) => void;
  onItemHover: (index: number) => void;
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
  onItemHover
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  
  // Aggiungi uno stato per distinguere tra selezione da tastiera e da mouse
  const lastInputType = useRef<'keyboard' | 'mouse'>('keyboard');

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
    return (
      <div className="p-4 text-center text-gray-500">
        <div className="text-sm text-slate-400">Nessun risultato trovato</div>
        <div className="text-xs mt-1 text-slate-500">Prova con altre parole chiave o premi Enter per la ricerca semantica</div>
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