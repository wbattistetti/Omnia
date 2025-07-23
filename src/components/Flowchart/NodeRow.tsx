import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useReactFlow } from 'reactflow';
import { GripVertical, Trash2, Edit3 } from 'lucide-react';
import { SIDEBAR_TYPE_ICONS } from '../Sidebar/sidebarTheme';
import { IntellisenseMenu } from '../Intellisense/IntellisenseMenu';
import { IntellisenseItem } from '../Intellisense/IntellisenseTypes';
import { LABEL_COLORS } from './labelColors';
import { getLabelColor } from '../../utils/labelColor';
import { NodeRowActionsOverlay } from './NodeRowActionsOverlay';
import { useOverlayBuffer } from '../../hooks/useOverlayBuffer';
import { NodeRowEditor } from './NodeRowEditor';
import { NodeRowData } from '../../types/project';
import { NodeRowProps } from '../../types/NodeRowTypes';
import { SIDEBAR_TYPE_COLORS } from '../Sidebar/sidebarTheme';
import { NodeRowLabel } from './NodeRowLabel';
import { NodeRowIntellisense } from './NodeRowIntellisense';
import { useNodeRowDrag } from '../../hooks/useNodeRowDrag';

export const NodeRow = React.forwardRef<HTMLDivElement, NodeRowProps>((
  {
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
  },
  ref
) => {
  const [isEditing, setIsEditing] = useState(forceEditing);
  const [currentText, setCurrentText] = useState(row.text);
  const [included, setIncluded] = useState(row.included !== false); // default true
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
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
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
    if (currentText.trim() === '') {
      onDelete(row);
    } else {
      setCurrentText(row.text);
      setIsEditing(false);
      setShowIntellisense(false);
      setIntellisenseQuery('');
      if (typeof onEditingEnd === 'function') {
        onEditingEnd();
      }
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
  if (row.categoryType && SIDEBAR_TYPE_COLORS[row.categoryType]) {
    bgColor = SIDEBAR_TYPE_COLORS[row.categoryType].light;
    labelTextColor = '#111';
  } else {
    if (typeof propBgColor === 'string') bgColor = propBgColor;
    if (typeof propTextColor === 'string') labelTextColor = propTextColor;
    if (!bgColor || !labelTextColor) {
      const colorObj = getLabelColor(row.categoryType || '', row.userActs);
      bgColor = colorObj.bg;
      labelTextColor = colorObj.text;
    }
  }

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
        style={{ ...conditionalStyles, background: included ? 'transparent' : '#f3f4f6', border: 'none', paddingLeft: 0, paddingRight: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, minHeight: 0, height: 'auto' }}
        onMouseEnter={() => setShowIcons(true)}
        onMouseLeave={() => setShowIcons(false)}
        {...(onMouseMove ? { onMouseMove } : {})}
      >
      {isEditing ? (
        <NodeRowEditor
          value={currentText}
          onChange={handleTextChange}
          onKeyDown={handleKeyDownInternal}
          inputRef={inputRef}
          placeholder="Type what you need here..."
        />
      ) : (
          <NodeRowLabel
            row={row}
            included={included}
            setIncluded={val => {
              setIncluded(val);
              if (typeof onUpdate === 'function') {
                onUpdate({ ...row, included: val }, row.text);
              }
            }}
            labelRef={labelRef}
            Icon={row.categoryType ? SIDEBAR_TYPE_ICONS[row.categoryType] : null}
            showIcons={showIcons}
                iconPos={iconPos}
                canDelete={canDelete}
                onEdit={() => setIsEditing(!isEditing)}
                onDelete={() => onDelete(row)}
                onDrag={handleMouseDown}
                isEditing={isEditing}
                setIsEditing={setIsEditing}
            bgColor={bgColor}
            labelTextColor={labelTextColor}
            onDoubleClick={handleDoubleClick}
          />
        )}
        </div>
      
      <NodeRowIntellisense
        showIntellisense={showIntellisense}
        isEditing={isEditing}
        nodeOverlayPosition={nodeOverlayPosition}
        intellisenseQuery={intellisenseQuery}
        inputRef={inputRef}
        handleIntellisenseSelect={handleIntellisenseSelect}
        handleIntellisenseClose={handleIntellisenseClose}
      />
    </>
  );
});