import React, { useState, useEffect } from 'react';
import { EdgeProps, getBezierPath } from 'reactflow';
import { Pencil, Trash2, Link, Link2Off as LinkOff } from 'lucide-react';
import { normalizeMarkerEnd } from '../../utils/markerUtils';

export type CustomEdgeProps = EdgeProps & {
  onDeleteEdge?: (edgeId: string) => void;
};

export const CustomEdge: React.FC<CustomEdgeProps> = (props) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    onDeleteEdge,
    data,
  } = props;

  const [hovered, setHovered] = useState(false);
  const [showConditionIntellisense, setShowConditionIntellisense] = useState(false);
  const [intellisensePosition, setIntellisensePosition] = useState({ x: 0, y: 0 });
  // Stato per hover sulla label
  const [labelHovered, setLabelHovered] = useState(false);

  // Handler per apertura intellisense
  const handleOpenIntellisense = (x: number, y: number) => {
    setIntellisensePosition({ x, y });
    setShowConditionIntellisense(true);
  };
  // Handler per chiusura intellisense
  const handleCloseIntellisense = () => setShowConditionIntellisense(false);
  // Handler per annullare condizione
  const handleUncondition = () => {
    if (props.data && typeof props.data.onUpdate === 'function') {
      props.data.onUpdate({ label: undefined });
    }
  };

  const edgePath = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })[0];

  // Midpoint for icons
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  // Icon size and box
  const ICON_SIZE = 18;
  const ICON_BOX = 28;

  // Normalizza markerEnd: accetta solo 'arrowhead'
  const getNormalizedMarkerEnd = (markerEnd: string | undefined) => {
    if (!markerEnd) return undefined;
    // Se contiene 'url(' o apici, restituisci solo 'arrowhead'
    if (markerEnd.includes('url(') || markerEnd.includes("'") || markerEnd.includes('"')) {
      return 'arrowhead';
    }
    return markerEnd;
  };

  // Prefer onDeleteEdge from data if present
  const handleDelete = (edgeId: string) => {
    if (data && typeof data.onDeleteEdge === 'function') {
      data.onDeleteEdge(edgeId);
    } else if (onDeleteEdge) {
      onDeleteEdge(edgeId);
    }
  };

  // LOG: ogni render, props e stile
  useEffect(() => {
    // Nuovo log: markerEnd e strokeDasharray
    console.log('[CustomEdge][RENDER]', {
      id,
      markerEnd,
      strokeDasharray: style?.strokeDasharray,
      style,
      props
    });
  });

  useEffect(() => {
    console.log('[DEBUG][CustomEdge]', { id, label: props.label });
  }, [props.label, id]);

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ pointerEvents: 'all' }}
    >
      {/* Edge path */}
      <path
        id={id}
        style={{ ...style, strokeDasharray: undefined }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd ? `url(#${getNormalizedMarkerEnd(markerEnd)})` : undefined}
        ref={el => {
          if (el) {
            // Nuovo log: markerEnd e strokeDasharray su SVG
            const dash = el.getAttribute('stroke-dasharray');
            const marker = el.getAttribute('marker-end');
            console.log('[CustomEdge][SVG]', { id, markerEnd: marker, strokeDasharray: dash });
          }
        }}
      />
      {/* Label/icone condizione al centro della linea */}
      {/* Mostra label e icone SEMPRE se la edge ha una label */}
      {props.label && (
        <g>
          {/* Label */}
          <foreignObject
            x={midX - 48} // 40 + 8px di margine sinistra
            y={midY - 24} // 16 + 8px di margine sopra
            width={96}    // 80 + 16px (8px per lato)
            height={48}   // 32 + 16px (8px per lato)
            style={{ overflow: 'visible', pointerEvents: 'none' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'auto',
                padding: 8,
                background: 'transparent'
              }}
              onMouseEnter={() => setLabelHovered(true)}
              onMouseLeave={() => setLabelHovered(false)}
            >
              <span style={{ color: '#8b5cf6', fontSize: 12, background: 'white', borderRadius: 4, padding: '2px 6px', fontWeight: 500, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                {props.label}
              </span>
              <span style={{ display: 'inline-flex', width: 36, minWidth: 36, justifyContent: 'flex-start' }}>
                {labelHovered && (
                  <>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                      onClick={e => {
                        e.stopPropagation();
                        handleOpenIntellisense(midX, midY + 20);
                      }}
                      title="Modifica condizione"
                    >
                      <Pencil size={14} color="#a16207" />
                    </button>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, marginLeft: 2 }}
                      onClick={e => {
                        e.stopPropagation();
                        handleUncondition();
                      }}
                      title="Rendi il link non condizionato"
                    >
                      <LinkOff size={14} color="#888" />
                    </button>
                  </>
                )}
              </span>
            </div>
          </foreignObject>
          {/* Intellisense sotto la label */}
          {showConditionIntellisense && (
            <foreignObject
              x={intellisensePosition.x - 80}
              y={intellisensePosition.y}
              width={160}
              height={120}
              style={{ overflow: 'visible', pointerEvents: 'none' }}
            >
              <div style={{ pointerEvents: 'auto', zIndex: 100 }}>
                {/* Qui va l'intellisense condizioni */}
                <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', padding: 8 }}>
                  <span style={{ color: '#888', fontSize: 12 }}>Qui va l'intellisense condizioni</span>
                </div>
              </div>
            </foreignObject>
          )}
        </g>
      )}
      {/* Se il link NON è condizionato, mostra icona Link al centro SOLO se selezionato */}
      {(!props.label && props.selected) && (
        <foreignObject
          x={midX - 12}
          y={midY - 12}
          width={24}
          height={24}
          style={{ overflow: 'visible', pointerEvents: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}>
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
              onClick={e => {
                e.stopPropagation();
                handleOpenIntellisense(midX, midY + 20);
              }}
              title="Aggiungi condizione"
            >
              <Link size={16} color="#888" />
            </button>
          </div>
        </foreignObject>
      )}
      {/* Cestino staccato dalla handle di partenza SOLO se edge selezionata */}
      {props.selected && (
        <foreignObject
          x={
            sourcePosition === 'left' ? sourceX - 36 :
            sourcePosition === 'right' ? sourceX + 12 :
            sourceX - 12
          }
          y={
            sourcePosition === 'top' ? sourceY - 36 :
            sourcePosition === 'bottom' ? sourceY + 12 :
            sourceY - 12
          }
          width={24}
          height={24}
          style={{ overflow: "visible", pointerEvents: "none" }}
        >
          <div style={{
            display: "flex",
            alignItems: "center",
            pointerEvents: "auto",
            background: "#fff",
            borderRadius: 6,
            padding: 2,
            boxShadow: "0 1px 4px rgba(0,0,0,0.08)"
          }}>
            <Trash2
              size={16}
              color="#dc2626"
              style={{ cursor: "pointer", opacity: 0.85 }}
              onClick={e => { e.stopPropagation(); handleDelete(id); }}
              aria-label="Elimina collegamento"
              tabIndex={0}
              role="button"
            />
          </div>
        </foreignObject>
      )}
    </g>
  );
};

export default CustomEdge; 