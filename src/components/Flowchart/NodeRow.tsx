import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useReactFlow } from 'reactflow';
import { GripVertical, Trash2, Edit3, Bot, User, Database } from 'lucide-react';
import { IntellisenseMenu } from '../Intellisense/IntellisenseMenu';
import { IntellisenseItem } from '../Intellisense/IntellisenseTypes';

// Mappa delle icone per i tipi di categoria
const categoryIcons: { [key: string]: JSX.Element } = {
  agentActs: <Bot className="w-3 h-3 text-purple-400" />,
  userActs: <User className="w-3 h-3 text-green-400" />,
  backendActions: <Database className="w-3 h-3 text-blue-400" />,
};

/**
 * Props per NodeRow
 * @property id - id della riga
 * @property text - testo della riga
 * @property nodeTitle - titolo del nodo (opzionale)
 * @property nodeCanvasPosition - posizione canvas del nodo (opzionale)
 * @property categoryType - tipo categoria (opzionale)
 * @property onUpdate - callback per aggiornare il testo
 * @property onUpdateWithCategory - callback per aggiornare testo e categoria
 * @property onDelete - callback per eliminare la riga
 * @property onKeyDown - callback per keydown (opzionale)
 * @property onDragStart - callback per drag (opzionale)
 * @property index - indice della riga
 * @property canDelete - true se la riga può essere eliminata
 * @property totalRows - numero totale di righe
 * @property isHoveredTarget - true se la riga è target di hover (opzionale)
 * @property isBeingDragged - true se la riga è in drag (opzionale)
 * @property isPlaceholder - true se la riga è placeholder (opzionale)
 * @property style - stile custom (opzionale)
 * @property forceEditing - forza editing (opzionale)
 * @property onMouseEnter, onMouseLeave, onMouseMove - eventi mouse (opzionali)
 * @property userActs - array di stringhe per le azioni dell'utente (opzionale)
 */
export interface NodeRowProps {
  id: string;
  text: string;
  nodeTitle?: string;
  nodeCanvasPosition?: { x: number; y: number };
  categoryType?: string;
  onUpdate: (newText: string) => void;
  onUpdateWithCategory?: (newText: string, categoryType?: string) => void;
  onDelete: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onDragStart?: (id: string, index: number, clientX: number, clientY: number, rect: DOMRect) => void;
  index: number;
  canDelete: boolean;
  totalRows: number;
  isHoveredTarget?: boolean;
  isBeingDragged?: boolean;
  isPlaceholder?: boolean;
  style?: React.CSSProperties;
  forceEditing?: boolean;
  userActs?: string[];
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onMouseMove?: (e: React.MouseEvent) => void;
}

export const NodeRow = React.forwardRef<HTMLDivElement, NodeRowProps>(({ 
  id,
  text,
  nodeTitle,
  nodeCanvasPosition,
  categoryType,
  onUpdate, 
  onUpdateWithCategory,
  onDelete, 
  onKeyDown,
  onDragStart,
  index,
  canDelete,
  totalRows,
  isHoveredTarget = false,
  isBeingDragged = false,
  isPlaceholder = false,
  style,
  forceEditing = false,
  userActs,
  onMouseEnter,
  onMouseLeave,
  onMouseMove
}, ref) => {
  const [isEditing, setIsEditing] = useState(forceEditing);
  const [currentText, setCurrentText] = useState(text);
  const [showIntellisense, setShowIntellisense] = useState(false);
  const [intellisenseQuery, setIntellisenseQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [nodeOverlayPosition, setNodeOverlayPosition] = useState<{ left: number; top: number } | null>(null);
  const nodeContainerRef = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

  // Quando entri in editing, calcola la posizione del nodo
  useEffect(() => {
    if (isEditing) {
      let left = 0;
      let top = 0;
      if (nodeCanvasPosition && inputRef.current) {
        // Ottieni offset locale dell'input rispetto al nodo
        const inputOffset = inputRef.current.getBoundingClientRect();
        const nodeRect = nodeContainerRef.current?.getBoundingClientRect();
        const offsetX = nodeRect && inputOffset ? (inputOffset.left - nodeRect.left) : 0;
        const offsetY = nodeRect && inputOffset ? (inputOffset.top - nodeRect.top) : 0;
        // Ottieni pan/zoom
        const { x: panX, y: panY, zoom } = reactFlowInstance.toObject().viewport;
        // Ottieni bounding rect del container React Flow
        const container = document.querySelector('.react-flow');
        const containerRect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
        // Calcola posizione schermo
        left = containerRect.left + (nodeCanvasPosition.x + offsetX) * zoom + panX;
        top = containerRect.top + (nodeCanvasPosition.y + offsetY) * zoom + panY;
      } else if (nodeContainerRef.current) {
        const rect = nodeContainerRef.current.getBoundingClientRect();
        left = rect.left + window.scrollX;
        top = rect.bottom + window.scrollY;
      }
      setNodeOverlayPosition({ left, top });
    } else if (!isEditing) {
      setNodeOverlayPosition(null);
    }
  }, [isEditing, nodeCanvasPosition, reactFlowInstance]);

  useEffect(() => {
    if (forceEditing) setIsEditing(true);
  }, [forceEditing]);

  const handleSave = () => {
    onUpdate(currentText.trim() || text);
    setIsEditing(false);
    setShowIntellisense(false);
    setIntellisenseQuery('');
  };

  const handleCancel = () => {
    setCurrentText(text);
    setIsEditing(false);
    setShowIntellisense(false);
    setIntellisenseQuery('');
  };

  const handleKeyDownInternal = (e: React.KeyboardEvent) => {
    
    if (e.key === 'Enter' && showIntellisense) {
      // Let intellisense handle this
      return;
    } else if (e.key === '/' && !showIntellisense) {
      // Activate intellisense with slash
      setIntellisenseQuery('');
      setShowIntellisense(true);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      if (showIntellisense) {
        setShowIntellisense(false);
        setIntellisenseQuery('');
      } else {
        if (onKeyDown) onKeyDown(e); // Propaga ESC al parent
        handleCancel();
      }
    } else if (e.key === 'Enter') {
      // Only save if intellisense is not open
      if (!showIntellisense) {
        if (onKeyDown) onKeyDown(e);
        handleSave();
      } else {
        // Intellisense is open, let it handle Enter
      }
    }
  };

  // Handle text change and trigger intellisense
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setCurrentText(newText);
    
    // Auto-trigger intellisense when typing
    if (newText.trim().length > 0) {
      setIntellisenseQuery(newText);
      setShowIntellisense(true);
    } else {
      setShowIntellisense(false);
      setIntellisenseQuery('');
    }
  };

  const handleIntellisenseSelect = (item: IntellisenseItem) => {
    setCurrentText(item.name);
    setShowIntellisense(false);
    setIntellisenseQuery('');
    
    // Auto-save the selection with category type
    if (onUpdateWithCategory) {
      onUpdateWithCategory(item.name, item.categoryType);
    } else {
      onUpdate(item.name);
    }
    setIsEditing(false);
  };

  const handleIntellisenseClose = () => {
    setShowIntellisense(false);
    setIntellisenseQuery('');
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (onDragStart && ref && 'current' in ref && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      onDragStart(id, index, e.clientX, e.clientY, rect);
    }
  };

  // Stili condizionali
  let conditionalStyles: React.CSSProperties = {};
  let conditionalClasses = '';

  if (isPlaceholder) {
    conditionalStyles = {
      height: 0,
      opacity: 0,
      margin: 0,
      padding: 0,
      overflow: 'hidden'
    };
  } else if (isBeingDragged) {
    conditionalStyles = {
      ...style,
      position: 'absolute',
      zIndex: 1000,
      opacity: 0.8,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      backgroundColor: '#475569',
      pointerEvents: 'none'
    };
  }

  // Calcolo il colore di sfondo per la label
  let bgColor = '';
  if ((categoryType && categoryType.toLowerCase() === 'backendactions') || (text && text.toLowerCase().includes('backend call'))) {
    bgColor = '#add8e6'; // azzurro
  } else if (Array.isArray(userActs) && userActs.length > 0) {
    bgColor = '#ffd699'; // arancione
  } else {
    bgColor = '#b2fab4'; // verde chiaro
  }

  return (
    <>
    <div 
      ref={nodeContainerRef}
      className={`flex items-center bg-slate-600 py-1 px-2 rounded-md group hover:bg-slate-500 transition-colors ${
        isHoveredTarget ? 'ring-2 ring-red-400 ring-inset' : ''
      } ${conditionalClasses}`}
      style={conditionalStyles}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
    >
      <div
        className="cursor-grab nodrag"
        onMouseDown={handleMouseDown}
      >
        <GripVertical 
          className="w-3 h-3 text-slate-400 mr-2 opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>
      
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={currentText}
          onChange={handleTextChange}
          onKeyDown={handleKeyDownInternal}
          className="flex-1 bg-slate-700 text-white text-[8px] px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 border border-slate-500 nodrag"
          autoFocus
          placeholder="Type what you need here..."
        />
      ) : (
        <span 
          className="flex-1 text-white text-[8px] cursor-pointer hover:text-purple-300 transition-colors flex items-center" 
          style={{ background: bgColor, borderRadius: 4, padding: '2px 4px' }}
          onDoubleClick={handleDoubleClick}
          title="Double-click to edit, start typing for intellisense"
        >
          {/* Icona actType se presente */}
          {categoryType && categoryIcons[categoryType] && (
            <span className="mr-1 flex items-center">{categoryIcons[categoryType]}</span>
          )}
          {text}
        </span>
      )}
      
      <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => setIsEditing(!isEditing)} 
          className="text-slate-400 hover:text-white transition-colors"
          title="Edit row"
        >
          <Edit3 className="w-2 h-2" />
        </button>
        {canDelete && (
          <button 
            onClick={onDelete} 
            className="text-red-400 hover:text-red-300 transition-colors"
            title="Delete row"
          >
            <Trash2 className="w-2 h-2" />
          </button>
        )}
      </div>
    </div>
    {/* Intellisense Menu in overlay stile EdgeConditionSelector, posizionato sotto il nodo */}
    {showIntellisense && isEditing && nodeOverlayPosition && createPortal(
      <div
        className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-xl p-3"
        style={{
          left: nodeOverlayPosition.left,
          top: nodeOverlayPosition.top + 4,
          minWidth: '280px'
        }}
      >
        {/* Header */}
        <div className="text-sm font-medium text-gray-700 mb-2">
          Seleziona azione o atto per il nodo
        </div>
        {/* Help text */}
        <div className="text-xs text-gray-500 mb-2">
          Inizia a digitare per vedere le azioni disponibili
        </div>
      <IntellisenseMenu
        isOpen={showIntellisense}
        query={intellisenseQuery}
        position={{ x: 0, y: 0 }}
          referenceElement={inputRef.current}
        onSelect={handleIntellisenseSelect}
        onClose={handleIntellisenseClose}
        filterCategoryTypes={['agentActs', 'userActs', 'backendActions']}
      />
      </div>,
      document.body
    )}
    </>
  );
});