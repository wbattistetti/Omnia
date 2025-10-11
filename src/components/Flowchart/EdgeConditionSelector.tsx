import React, { useState, useRef, useEffect } from 'react';
import { Link2Off as LinkOff } from 'lucide-react';
import { IntellisenseMenu } from '../Intellisense/IntellisenseMenu';
import { IntellisenseItem } from '../Intellisense/IntellisenseTypes';

/**
 * Props per EdgeConditionSelector
 * @property position - posizione assoluta {x, y} per il popup
 * @property onSelectCondition - callback quando viene selezionata una condizione
 * @property onSelectUnconditioned - callback per collegamento senza condizione
 * @property onSelectElse - callback per marcare questo collegamento come ELSE (fallback)
 * @property onClose - callback per chiusura del popup
 */
export interface EdgeConditionSelectorProps {
  position: { x: number; y: number };
  onSelectCondition: (item: IntellisenseItem) => void;
  onSelectUnconditioned: () => void;
  onSelectElse?: () => void;
  onClose: () => void;
  onCreateCondition?: (name: string, scope?: 'global' | 'industry') => void;
}

/**
 * Popup per selezionare una condizione (o nessuna) per un collegamento edge.
 */
export const EdgeConditionSelector: React.FC<EdgeConditionSelectorProps> = ({
  position,
  onSelectCondition,
  onSelectUnconditioned,
  onSelectElse,
  onClose,
  onCreateCondition
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showIntellisense, setShowIntellisense] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input e apri subito l'intellisense quando il componente viene montato
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      setShowIntellisense(true);
      try { console.log('[CondUI][mount] focus + showIntellisense'); } catch {}
    }
  }, []);

  // Chiudi il popup se clicchi fuori
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.edge-condition-selector')) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Gestione ESC e intellisense
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (showIntellisense) {
        setShowIntellisense(false);
      } else {
        onClose();
      }
    } else if (e.key === 'Enter') {
      // Conferma: se non è selezionato un item, crea/usa condizione con la label digitata
      const name = (inputValue || '').trim();
      e.preventDefault();
      e.stopPropagation();
      if (!name) return;
      try { console.log('[CondFlow] enter', { name }); } catch {}
      if (onCreateCondition) onCreateCondition(name, 'industry');
      setShowIntellisense(false);
    }
  };

  // Gestione input e apertura intellisense
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    // mantieni aperto; il provider interno filtrerà i risultati
    setShowIntellisense(true);
  };

  // Selezione da intellisense
  const handleIntellisenseSelect = (item: IntellisenseItem) => {
    try { console.log('[CondUI][select]', item); } catch {}
    onSelectCondition(item);
    setShowIntellisense(false);
  };

  const handleIntellisenseClose = () => {
    setShowIntellisense(false);
  };

  // Gestione creazione nuova condizione
  const handleCreateCondition = (name: string, scope?: 'global' | 'industry') => {
    try { console.log('[CondUI][create]', { name, scope }); } catch {}
    if (onCreateCondition) {
      onCreateCondition(name, scope);
      setShowIntellisense(false);
    }
  };

  // Click su collegamento senza condizione
  const handleUnconditionedClick = () => {
    onSelectUnconditioned();
  };

  return (
    <div
      className="edge-condition-selector fixed z-50 bg-white border border-gray-300 rounded-lg shadow-xl p-3"
      style={{
        // allinea il top del popup esattamente al punto, centrato orizzontalmente (nessun gap)
        top: position.y,
        left: position.x,
        transform: 'translate(-50%, 0)',
        width: 520,
        minWidth: 360
      }}
    >
      {/* Arrow anchor (punta il punto di rilascio, dal bordo superiore del popup) */}
      <div
        style={{
          position: 'absolute',
          top: -5,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderBottom: '7px solid rgba(209,213,219,1)'
        }}
      />
      {/* Header */}
      <div className="text-sm font-medium text-gray-700 mb-2">
        Seleziona condizione
      </div>
      {/* Input e pulsanti */}
      <div className="flex items-center space-x-2">
        {/* Campo input */}
        <div className="flex-1" style={{ maxWidth: 360 }}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder="Digita per cercare condizioni..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        {/* Pulsante Else accanto alla textbox */}
        <button
          onClick={() => { onSelectElse && onSelectElse(); }}
          className="px-3 py-2 text-sm font-semibold rounded-md border border-purple-600 bg-purple-600 text-white hover:bg-purple-500"
          title="Else: usa questo collegamento solo se tutte le altre condizioni del nodo sorgente sono false"
        >
          Else
        </button>
        {/* Pulsante collegamento senza condizione */}
        <button
          onClick={handleUnconditionedClick}
          className="flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors"
          title="Collegamento senza condizione"
        >
          <LinkOff className="w-4 h-4 text-gray-600" />
        </button>
      </div>
      {/* Help text */}
      <div className="text-xs text-gray-500 mt-2">
        Inizia a digitare per vedere le condizioni disponibili, usa Else per il ramo di fallback, o l'icona per un collegamento incondizionato.
      </div>
      {/* Intellisense Menu */}
      {showIntellisense && (
        <IntellisenseMenu
          isOpen={showIntellisense}
          query={inputValue}
          position={{ x: 0, y: 0 }}
          referenceElement={inputRef.current}
          onSelect={handleIntellisenseSelect}
          onClose={handleIntellisenseClose}
          filterCategoryTypes={['conditions']}
          onCreateNew={handleCreateCondition}
        />
      )}
    </div>
  );
};