// Executive summary: Represents a single node in the response tree, including drag & drop and visual state.
import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, MessageCircle, Trash2 } from 'lucide-react';
import getIconComponent from './icons';
import { TreeNodeProps } from './types';
import styles from './TreeNode.module.css';
import { useDrop, useDrag } from 'react-dnd';
import { ESCALATION_COLORS } from './escalationColors';

interface TreeNodeExtraProps {
  showLabel?: boolean;
  selected?: boolean;
  domId?: string;
  onCancelNewNode?: (id: string) => void;
  childrenNodes?: TreeNodeProps[];
  escalationLabel?: string;
  foreColor?: string; // nuovo prop
  bgColor?: string; // nuovo prop
}

const TreeNode: React.FC<TreeNodeProps & TreeNodeExtraProps> = ({ 
  text, 
  type,
  level = 0, 
  expanded = true,
  id,
  icon,
  color,
  parentId,
  label,
  primaryValue,
  parameters,
  showLabel,
  selected,
  domId,
  onDrop,
  onCancelNewNode,
  childrenNodes = [],
  escalationLabel,
  included,
  onToggleInclude,
  isSingleEscalation,
  foreColor,
  bgColor
}) => {
  const INDENT_WIDTH = 24;
  const [dropTarget, setDropTarget] = useState<'before' | 'after' | 'child' | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(primaryValue || '');
  const [hasEdited, setHasEdited] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Stato per drag&drop
  const [isDragging, setIsDragging] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Focus automatico solo subito dopo il drop (selected true e non ancora editato)
  useEffect(() => {
    if (selected && primaryValue !== undefined && !hasEdited) {
      setEditing(true);
      setEditValue(primaryValue);
    }
  }, [selected, primaryValue, hasEdited]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleEditBlur = () => {
    setEditing(false);
    setHasEdited(true);
    // Qui puoi propagare il valore editato nello stato globale se serve
  };
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setEditing(false);
      setHasEdited(true);
      // Qui puoi propagare il valore editato nello stato globale se serve
    }
    if (e.key === 'Escape' && !hasEdited && typeof onCancelNewNode === 'function') {
      // ESC su nodo nuovo: cancella
      onCancelNewNode(id);
    }
  };

  const [{ isOver }, drop] = useDrop({
    accept: 'ACTION',
    hover(item: any, monitor) {
      const node = nodeRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const y = monitor.getClientOffset()?.y ?? 0;
      const relY = y - rect.top;
      if (relY < rect.height * 0.25) {
        setDropTarget('before');
      } else if (relY > rect.height * 0.75) {
        setDropTarget('after');
      } else {
        setDropTarget('child');
      }
    },
    drop(item: any, monitor) {
      if (dropTarget && item && typeof item === 'object' && typeof onDrop === 'function') {
        onDrop(id, dropTarget, item);
      }
      setDropTarget(null);
    },
    collect: monitor => ({
      isOver: monitor.isOver({ shallow: true })
    })
  });

  // Drag source per evidenziare il nodo trascinato
  const [{ isDragging: isDraggingNode }, drag, preview] = useDrag({
    type: 'ACTION',
    item: () => {
      return { id };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  });

  drag(drop(nodeRef));

  const getBgClass = () => {
    switch (type) {
      case 'nomatch':
        return styles.bgNoMatch;
      case 'noinput':
        return styles.bgNoInput;
      case 'action':
        return styles.bgAction;
      default:
        return styles.bgRoot;
    }
  };

  // Determina se mostrare la textbox di editing solo per Messaggio o Domanda
  const showEditingBox = (icon === 'MessageCircle' || icon === 'HelpCircle');

  // LOG: stampa il testo del nodo
  // console.log('[TreeNode] render', { id, text });

  // Nodo escalation: stile speciale, label, collassabile
  if (type === 'escalation') {
    // LOG: debug indentazione escalation
    // eslint-disable-next-line no-console
    console.log(`[ESCALATION NODE] id=${id} escalationLabel=${escalationLabel} level=${level} parentId=${parentId} childrenCount=${childrenNodes?.length}`);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const handleDelete = () => {
      setShowDeleteConfirm(true);
    };
    // Colore dinamico escalation
    const colorKey = (escalationLabel || '').toLowerCase();
    let colorConfig = ESCALATION_COLORS[colorKey] || ESCALATION_COLORS['default'];
    if (foreColor) {
      colorConfig = { ...colorConfig, border: foreColor, fore: foreColor };
    }
    if (bgColor) {
      colorConfig = { ...colorConfig, background: bgColor };
    }
    return (
      <div
        ref={nodeRef}
        id={domId}
        className={styles.escalationBlock}
        style={{
          border: `1.5px solid ${colorConfig.border}`,
          transition: 'border-color 0.2s',
        }}
      >
        {/* Ripristino testata recovery interna, come era prima */}
        {isSingleEscalation ? (
          <div style={{ height: 8 }} />
        ) : (
          <div
            className={styles.escalationHeader}
            style={{
              color: colorConfig.fore,
              background: colorConfig.background,
              borderRadius: 8,
              padding: '4px 12px',
              display: 'flex',
              alignItems: 'center',
              fontWeight: 600,
              fontSize: 15,
              marginBottom: 8,
              opacity: included ? 1 : 0.6,
              transition: 'color 0.2s, opacity 0.2s',
            }}
          >
            <span onClick={() => setCollapsed(c => !c)} style={{ display: 'flex', alignItems: 'center' }}>
              {collapsed ? <ChevronRight size={16} style={{ marginRight: 4, verticalAlign: 'middle', color: colorConfig.fore }} /> : <ChevronDown size={16} style={{ marginRight: 4, verticalAlign: 'middle', color: colorConfig.fore }} />}
              {/* Checkbox inclusion custom */}
              <span
                onClick={e => { e.stopPropagation(); onToggleInclude?.(id, !included); }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20,
                  height: 20,
                  border: `2px solid ${colorConfig.fore}`,
                  borderRadius: 4,
                  background: 'transparent',
                  cursor: 'pointer',
                  marginRight: 8,
                  transition: 'border 0.2s',
                }}
              >
                {included && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <polyline points="3.5 7.5 6 10 10.5 4.5" stroke={colorConfig.fore} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span>{escalationLabel || text}</span>
            </span>
            {onCancelNewNode && !showDeleteConfirm && (
              <span title="Elimina recovery">
                <Trash2
                  size={17}
                  style={{ color: colorConfig.fore, marginLeft: 12, cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); setShowDeleteConfirm(true); }}
                  onMouseOver={e => { e.currentTarget.style.color = '#b91c1c'; }}
                  onMouseOut={e => { e.currentTarget.style.color = colorConfig.fore; }}
                />
              </span>
            )}
            {showDeleteConfirm && (
              <span style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
                <button
                  style={{ background: colorConfig.fore, color: '#fff', border: 'none', borderRadius: 6, padding: '2px 12px', fontWeight: 700, cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); setShowDeleteConfirm(false); if (onCancelNewNode) onCancelNewNode(id); }}
                >Conferma</button>
                <button
                  style={{ background: '#eee', color: '#333', border: 'none', borderRadius: 6, padding: '2px 12px', fontWeight: 500, cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); setShowDeleteConfirm(false); }}
                >Annulla</button>
              </span>
            )}
          </div>
        )}
        {!collapsed && childrenNodes && childrenNodes.length > 0 && (
          <div style={{ marginLeft: 24, marginTop: 8, opacity: included ? 1 : 0.5, color: included ? undefined : '#bbb' }}>
            {childrenNodes.map(child => (
              <TreeNode key={child.id} {...child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      ref={nodeRef}
      id={domId}
      style={{ position: 'relative', opacity: isDraggingNode ? 0.5 : 1 }}
    >
      {/* Feedback visivo react-dnd */}
      {isOver && dropTarget === 'before' && (
        <div style={{ position: 'absolute', top: -2, left: 0, right: 0, height: 4, background: '#2563eb', borderRadius: 2, zIndex: 10 }} />
      )}
      <div
        className={`${styles.node} ${getBgClass()}`}
        style={{
          marginLeft: `${level * INDENT_WIDTH}px`,
          border: selected ? '2px solid #2563eb' : isDraggingNode ? '2px solid #60a5fa' : undefined,
          boxShadow: selected || isDraggingNode ? '0 0 0 2px #93c5fd' : undefined,
          background: selected ? '#e0e7ff' : isDraggingNode ? '#e0f2fe' : undefined,
          color: '#111' // Forecolor nero per il testo
        }}
      >
        {expanded ? <ChevronDown size={16} style={{ marginRight: 8 }} /> : <ChevronRight size={16} style={{ marginRight: 8 }} />}
        <div style={{ marginRight: 8 }} className={color || ''}>
          {(() => {
            const iconComponent = type === 'action' && icon ? getIconComponent(icon) : null;
            return iconComponent || <MessageCircle size={16} />;
          })()}
        </div>
        {/* LABEL opzionale */}
        {showLabel && label && (
          <span style={{ fontSize: 12, color: '#888', opacity: 0.7, marginRight: 8 }}>{label}</span>
        )}
        {/* Valore principale: textbox se editing SOLO per Messaggio o Domanda */}
        {showEditingBox && editing && primaryValue !== undefined && !hasEdited ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleEditBlur}
            onKeyDown={handleEditKeyDown}
            style={{
              fontWeight: 500,
              fontSize: 15,
              padding: 2,
              border: '1px solid #2563eb',
              borderRadius: 4,
              minWidth: 80,
              width: '100%', // filla la riga!
              boxSizing: 'border-box'
            }}
          />
        ) : primaryValue ? (
          <span style={{ fontWeight: 500, fontSize: 15 }}>{editValue}</span>
        ) : (
          <span style={{ fontSize: '0.875rem' }}>{text}</span>
        )}
        {isOver && dropTarget === 'child' && (
          <div style={{ position: 'absolute', inset: 0, border: '2px solid #2563eb', borderRadius: 6, pointerEvents: 'none', zIndex: 10, background: 'rgba(96,165,250,0.08)' }} />
        )}
      </div>
      {/* Parametri figli indentati */}
      {parameters && parameters.length > 0 && (
        <div style={{ marginLeft: `${(level + 1) * INDENT_WIDTH}px`, marginTop: 2 }}>
          {parameters.map(param => (
            <div key={param.key} style={{ fontSize: 14, color: '#333', marginBottom: 2 }}>
              <b>{param.key}:</b> {param.value}
            </div>
          ))}
        </div>
      )}
      {isOver && dropTarget === 'after' && (
        <div style={{ position: 'absolute', bottom: -2, left: 0, right: 0, height: 4, background: '#2563eb', borderRadius: 2, zIndex: 10 }} />
      )}
    </div>
  );
};

export default TreeNode; 