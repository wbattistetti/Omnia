import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useReactFlow } from 'reactflow';
import { GripVertical, Trash2, Edit3, Bot, User, Database } from 'lucide-react';
import { IntellisenseMenu } from '../Intellisense/IntellisenseMenu';
import { IntellisenseItem } from '../Intellisense/IntellisenseTypes';
import { LABEL_COLORS } from './labelColors';
import { getLabelColor } from '../../utils/labelColor';
import { NodeRowActionsOverlay } from './NodeRowActionsOverlay';
import { useOverlayBuffer } from '../../hooks/useOverlayBuffer';
import { NodeRowEditor } from './NodeRowEditor';

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
 * @property onEditingEnd - callback chiamato dopo il salvataggio o annullamento dell'editing
 */
export interface NodeRowProps {
  row: NodeRowData;
  nodeTitle?: string;
  nodeCanvasPosition?: { x: number; y: number };
  onUpdate: (row: NodeRowData, newText: string) => void;
  onUpdateWithCategory?: (row: NodeRowData, newText: string, categoryType?: string) => void;
  onDelete: (row: NodeRowData) => void;
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
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  bgColor?: string;
  textColor?: string;
  onEditingEnd?: () => void;
}

export const NodeRow = React.forwardRef<HTMLDivElement, NodeRowProps>(({ 
  row,
  nodeTitle,
  nodeCanvasPosition,
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
  onMouseEnter,
  onMouseLeave,
  onMouseMove,
  bgColor: propBgColor,
  textColor: propTextColor,
  onEditingEnd
}, ref) => {
  const [isEditing, setIsEditing] = useState(forceEditing);
  const [currentText, setCurrentText] = useState(row.text);
  const [showIntellisense, setShowIntellisense] = useState(false);
  const [intellisenseQuery, setIntellisenseQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [nodeOverlayPosition, setNodeOverlayPosition] = useState<{ left: number; top: number } | null>(null);
  const nodeContainerRef = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();
  const [showIcons, setShowIcons] = useState(false);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [iconPos, setIconPos] = useState<{top: number, left: number} | null>(null);

  // Calcola la posizione e dimensione della zona buffer
  const bufferRect = useOverlayBuffer(labelRef, iconPos, showIcons);

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

  // Calcola la posizione delle icone appena fuori dal bordo destro del nodo
  useEffect(() => {
    if (showIcons && labelRef.current) {
      const labelRect = labelRef.current.getBoundingClientRect();
      setIconPos({
        top: labelRect.top,
        left: labelRect.right + 4 // 4px fuori dal bordo destro
      });
    } else {
      setIconPos(null);
    }
  }, [showIcons]);

  useEffect(() => {
    if (forceEditing) setIsEditing(true);
  }, [forceEditing]);

  useEffect(() => {
    if (isEditing) {
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing && typeof onEditingEnd === 'function') {
      onEditingEnd();
    }
  }, [isEditing]);

  const handleSave = () => {
    onUpdate(row, currentText.trim() || row.text);
    setIsEditing(false);
    setShowIntellisense(false);
    setIntellisenseQuery('');
    if (typeof onEditingEnd === 'function') {
      onEditingEnd();
    }
  };

  const handleCancel = () => {
    setCurrentText(row.text);
    setIsEditing(false);
    setShowIntellisense(false);
    setIntellisenseQuery('');
    if (typeof onEditingEnd === 'function') {
      onEditingEnd();
    }
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
      onUpdateWithCategory(row, item.name, item.categoryType);
    } else {
      onUpdate(row, item.name);
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
      onDragStart(row.id, index, e.clientX, e.clientY, rect);
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

  // Calcolo il colore di sfondo e testo per la label
  let bgColor = '';
  let labelTextColor = '';
  if (typeof propBgColor === 'string') bgColor = propBgColor;
  if (typeof propTextColor === 'string') labelTextColor = propTextColor;
  if (!bgColor || !labelTextColor) {
    const colorObj = getLabelColor(row.categoryType, row.userActs);
    bgColor = colorObj.bg;
    labelTextColor = colorObj.text;
  }

  // LOG: stampa id, forceEditing, isEditing
  useEffect(() => {
    console.log(`[NodeRow] render row.id=${row.id} forceEditing=${forceEditing} isEditing=${isEditing}`);
  });

  return (
    <>
      {/* Zona buffer invisibile per tolleranza spaziale */}
      {bufferRect && showIcons && createPortal(
        <div
          style={{
            position: 'fixed',
            top: bufferRect.top,
            left: bufferRect.left,
            width: bufferRect.width,
            height: bufferRect.height,
            zIndex: 9998,
            pointerEvents: 'auto',
            background: 'transparent',
          }}
          onMouseEnter={() => setShowIcons(true)}
          onMouseLeave={() => setShowIcons(false)}
        />,
        document.body
      )}
      <div 
        ref={nodeContainerRef}
        className={`node-row-outer flex items-center group transition-colors ${
          isHoveredTarget ? 'ring-2 ring-red-400 ring-inset' : ''
        } ${conditionalClasses}`}
        style={{ ...conditionalStyles, background: 'transparent', border: 'none', paddingLeft: 0, paddingRight: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, minHeight: 0, height: 'auto' }}
        onMouseEnter={() => setShowIcons(true)}
        onMouseLeave={() => setShowIcons(false)}
        {...(onMouseMove ? { onMouseMove } : {})}
      >
      {/* Drag handle rimossa dal lato sinistro, ora solo in overlay */}
      
      {isEditing ? (
        <NodeRowEditor
          value={currentText}
          onChange={handleTextChange}
          onKeyDown={handleKeyDownInternal}
          inputRef={inputRef}
          placeholder="Type what you need here..."
        />
      ) : (
        <span
          ref={labelRef}
          className="flex-1 text-[8px] cursor-pointer hover:text-purple-300 transition-colors flex items-center relative"
          style={{ background: bgColor, color: labelTextColor, borderRadius: 4, paddingLeft: row.categoryType && categoryIcons[row.categoryType] ? 4 : 0, paddingRight: 8, minHeight: '18px', lineHeight: 1.1, marginTop: 0, marginBottom: 0 }}
          onDoubleClick={handleDoubleClick}
          title="Double-click to edit, start typing for intellisense"
        >
          {/* Icona actType se presente */}
          {row.categoryType && categoryIcons[row.categoryType] && (
            <span className="mr-1 flex items-center">{categoryIcons[row.categoryType]}</span>
          )}
          {row.text}
          {/* Overlay icone azione fuori dal nodo, allineate alla label */}
          {showIcons && iconPos && createPortal(
            <NodeRowActionsOverlay
              iconPos={iconPos}
              showIcons={showIcons}
              canDelete={canDelete}
              onEdit={() => setIsEditing(!isEditing)}
              onDelete={() => onDelete(row)}
              onDrag={handleMouseDown}
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              labelRef={labelRef}
            />,
            document.body
          )}
        </span>
      )}
      
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
    </div>
    </>
  );
});