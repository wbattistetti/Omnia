// Executive summary: Represents a single node in the response tree, including drag & drop and visual state.
import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, MessageCircle, Trash2, ArrowRight } from 'lucide-react';
import getIconComponent from './icons';
import { TreeNodeProps } from './types';
import styles from './TreeNode.module.css';
import { useDrop, useDrag } from 'react-dnd';
import { ESCALATION_COLORS } from './escalationColors';
import ActionRow from './ActionRow';
import SmartTooltip from '../../SmartTooltip';
import { TooltipWrapper } from '../../TooltipWrapper';

interface TreeNodeExtraProps {
  showLabel?: boolean;
  selected?: boolean;
  domId?: string;
  onCancelNewNode?: (id: string) => void;
  childrenNodes?: TreeNodeProps[];
  escalationLabel?: string;
  foreColor?: string; // nuovo prop
  bgColor?: string; // nuovo prop
  currentStep?: string; // per nascondere il rettangolo recovery per start/success
}

const TreeNode: React.FC<TreeNodeProps & TreeNodeExtraProps> = ({ 
  text, 
  type,
  level = 0, 
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
  foreColor,
  bgColor,
  currentStep
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

  // Log dropTarget changes (after dropTarget and isOver are declared)
  useEffect(() => {
    if (dropTarget) {
      console.log(`[DND][${id}] dropTarget changed:`, dropTarget);
    }
  }, [dropTarget, id]);

  // Log isOver
  useEffect(() => {
    if (isOver) {
      console.log(`[DND][${id}] isOver: true, dropTarget:`, dropTarget);
    }
  }, [isOver, dropTarget, id]);

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

  // Nodo escalation: stile speciale, label, collassabile
  if (type === 'escalation') {
    // Se siamo negli step start o success, non mostrare il rettangolo recovery
    if (currentStep === 'start' || currentStep === 'success') {
      return (
        <div>
          {childrenNodes.map(child => (
            <TreeNode
              key={child.id}
              {...child}
              level={level + 1}
              selected={selected}
              onDrop={onDrop}
              onCancelNewNode={onCancelNewNode}
              domId={'tree-node-' + child.id}
              currentStep={currentStep}
            />
          ))}
        </div>
      );
    }
    
    // Altrimenti mostra il rettangolo recovery normale
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
          position: 'relative',
          minHeight: 40,
          overflow: 'visible',
        }}
      >
        {/* DnD preview: elegant insertion arrow */}
        {isOver && (dropTarget === 'before') && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 0,
            borderTop: '2px solid #2563eb',
            zIndex: 100,
            pointerEvents: 'none',
          }} />
        )}
        {isOver && (dropTarget === 'after' || dropTarget === 'child') && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 0,
            borderBottom: '2px solid #2563eb',
            zIndex: 100,
            pointerEvents: 'none',
          }} />
        )}
        {/* Ripristino testata recovery interna, come era prima */}
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
            <TooltipWrapper tooltip={<SmartTooltip text="Elimina recovery" tutorId="recovery_delete"><span /></SmartTooltip>}>
              {(show, triggerProps) => (
                <span
                  {...triggerProps}
                  style={{ position: 'relative', display: 'inline-block' }}
                >
                  <Trash2
                    size={17}
                    style={{ color: colorConfig.fore, marginLeft: 12, cursor: 'pointer' }}
                    onClick={e => { e.stopPropagation(); setShowDeleteConfirm(true); }}
                    onMouseOver={e => { e.currentTarget.style.color = '#b91c1c'; }}
                    onMouseOut={e => { e.currentTarget.style.color = colorConfig.fore; }}
                  />
                </span>
              )}
            </TooltipWrapper>
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
        {!collapsed && childrenNodes && childrenNodes.length > 0 && (
          <div style={{ marginLeft: 24, marginTop: 8, opacity: included ? 1 : 0.5, color: included ? undefined : '#bbb' }}>
            {childrenNodes.map(child => (
              <ActionRow
                key={child.id}
                icon={(() => {
                  const iconComponent = child.type === 'action' && child.icon ? getIconComponent(child.icon) : null;
                  return iconComponent || <MessageCircle size={16} />;
                })()}
                label={child.label}
                text={child.primaryValue || child.text}
                color={child.color}
                draggable={true}
                onEdit={() => {}} // enable editing mode for escalation children
                onDelete={onCancelNewNode ? () => onCancelNewNode(child.id) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // DEBUG: log every render for every node
  // console.log('RENDER TreeNode', id, 'type:', type, 'isOver:', isOver, 'dropTarget:', dropTarget);
  // console.log('RENDER TreeNode', id, type, 'isOver:', typeof isOver !== 'undefined' ? isOver : 'UNDEF', 'dropTarget:', dropTarget);
  return (
    <div 
      ref={nodeRef}
      id={domId}
      style={{
        position: 'relative',
        opacity: isDraggingNode ? 0.5 : 1,
        minHeight: 40,
        overflow: 'visible',
        // Removed all debug/test borders, boxShadows, backgrounds
        // Only keep real UI styles (add border if selected, for example)
        border: selected ? `1.5px solid ${color || '#a21caf'}` : 'none',
      }}
    >
      {/* Drag-and-drop preview arrows/icons can be rendered here if needed, but no debug lines or overlays */}
      <ActionRow
        icon={(() => {
          const iconComponent = type === 'action' && icon ? getIconComponent(icon) : null;
          return iconComponent || <MessageCircle size={16} />;
        })()}
        label={showLabel && label ? label : undefined}
        text={primaryValue ? editValue : text}
        color={color}
        selected={selected}
        draggable={true}
        onEdit={() => {}} // enable editing mode for now
        onDelete={onCancelNewNode ? () => onCancelNewNode(id) : undefined}
      />
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
    </div>
  );
};

export default TreeNode; 