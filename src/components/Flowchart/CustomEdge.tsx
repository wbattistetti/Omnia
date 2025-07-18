import React, { useState, useEffect, useRef } from 'react';
import { EdgeProps, getBezierPath } from 'reactflow';
import { Pencil, Trash2, Link, Link2Off as LinkOff, Settings } from 'lucide-react';
import { normalizeMarkerEnd } from '../../utils/markerUtils';
import { IntellisenseMenu } from '../Intellisense/IntellisenseMenu';
import { EdgeConditionSelector } from './EdgeConditionSelector';
import { createPortal } from 'react-dom';

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
  const [showConditionSelector, setShowConditionSelector] = useState(false);
  const [conditionSelectorPos, setConditionSelectorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [trashHovered, setTrashHovered] = useState(false);

  const labelSpanRef = useRef<HTMLDivElement>(null);
  const gearButtonRef = useRef<HTMLButtonElement>(null);

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
  // Handler per selezione condizione da intellisense
  const handleIntellisenseSelect = (item: any) => {
    if (props.data && typeof props.data.onUpdate === 'function') {
      props.data.onUpdate({ 
        label: item.description || item.name || '',
        actType: item.categoryType // Salva il tipo di act
      });
    }
    setShowConditionIntellisense(false);
  };

  // Handler per apertura EdgeConditionSelector
  const handleOpenConditionSelector = (x: number, y: number) => {
    setConditionSelectorPos({ x, y });
    setShowConditionSelector(true);
  };

  // Callback per selezione condizione
  const handleSelectCondition = (item: any) => {
    if (props.data && typeof props.data.onUpdate === 'function') {
      props.data.onUpdate({ label: item.description || item.name || '' });
    }
    setShowConditionSelector(false);
  };

  // Callback per link non condizionato
  const handleSelectUnconditioned = () => {
    if (props.data && typeof props.data.onUpdate === 'function') {
      props.data.onUpdate({ label: undefined });
    }
    setShowConditionSelector(false);
  };

  // Callback per chiusura
  const handleCloseSelector = () => {
    setShowConditionSelector(false);
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

  useEffect(() => {
  }, [id, props.selected]);

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ pointerEvents: 'all' }}
    >
      {/* Edge path */}
      <path
        id={id}
        style={{
          ...style,
          strokeDasharray: undefined,
          stroke: trashHovered ? '#dc2626' : (style.stroke || '#8b5cf6'),
          transition: 'stroke 0.15s',
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd ? `url(#${getNormalizedMarkerEnd(markerEnd)})` : undefined}
        ref={el => {
          if (el) {
          }
        }}
      />
      {/* Label/icone condizione al centro della linea */}
      {/* Mostra label e icone SEMPRE se la edge ha una label */}
      {(props.data?.label || props.label) && (
        <g>
          <foreignObject
            x={midX - 175}
            y={midY - 24}
            width={350}
            height={48}
            style={{ overflow: 'visible', pointerEvents: 'none' }}
          >
            <div
              style={{
                minWidth: 0,
                maxWidth: 350,
                width: 'fit-content',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'auto',
                background: 'rgba(255,255,255,0.92)',
                borderRadius: 6,
                boxShadow: '0 2px 8px rgba(139,92,246,0.10)',
                padding: '2px 8px',
                fontSize: 8,
                fontWeight: 500,
                lineHeight: 1.2,
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                textAlign: 'center',
                position: 'relative',
                zIndex: 2,
                border: labelHovered ? '1px solid #8b5cf6' : '1px solid transparent',
                transition: 'border 0.15s',
                cursor: 'pointer',
                userSelect: 'text',
              }}
              onMouseEnter={() => setLabelHovered(true)}
              onMouseLeave={() => setLabelHovered(false)}
              ref={labelSpanRef}
            >
              {/* Icona actType */}
              {props.data?.actType === 'agentActs' && (
                <span style={{ marginRight: 4, display: 'flex', alignItems: 'center' }} title="Agent act">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z"></path><path d="M6 22v-2c0-2.21 3.58-4 6-4s6 1.79 6 4v2"></path></svg>
                </span>
              )}
              {props.data?.actType === 'backendActions' && (
                <span style={{ marginRight: 4, display: 'flex', alignItems: 'center' }} title="Backend call">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10"/><path d="M7 12h10"/><path d="M7 16h10"/></svg>
                </span>
              )}
              {/* Label testo */}
              <span style={{
                display: 'inline-block',
                maxWidth: 330,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                WebkitLineClamp: 6,
                WebkitBoxOrient: 'vertical',
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                lineHeight: 1.2,
                padding: 0,
                verticalAlign: 'middle',
              }}>
                {props.data?.label || props.label}
              </span>
              <span style={{ display: 'inline-flex', width: 36, minWidth: 36, justifyContent: 'flex-start' }}>
                {labelHovered && (
                  <>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                      onClick={e => {
                        e.stopPropagation();
                        // Calcola posizione precisa sotto la label
                        if (labelSpanRef.current) {
                          const rect = labelSpanRef.current.getBoundingClientRect();
                          handleOpenConditionSelector(rect.left + window.scrollX, rect.bottom + window.scrollY + 1);
                        } else {
                          // fallback: centro SVG
                          const svg = document.querySelector('svg');
                          if (svg) {
                            const pt = svg.createSVGPoint();
                            pt.x = midX;
                            pt.y = midY + 24;
                            const ctm = svg.getScreenCTM();
                            if (ctm) {
                              const transformed = pt.matrixTransform(ctm);
                              handleOpenConditionSelector(transformed.x, transformed.y);
                            } else {
                              handleOpenConditionSelector(midX, midY + 24);
                            }
                          } else {
                            handleOpenConditionSelector(midX, midY + 24);
                          }
                        }
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
          {/* Intellisense sotto la label (ora sempre portale) */}
          {showConditionIntellisense && createPortal(
            <div style={{
              position: 'absolute',
              left: intellisensePosition.x,
              top: intellisensePosition.y,
              zIndex: 9999,
            }}>
              <IntellisenseMenu
                isOpen={showConditionIntellisense}
                query={typeof props.label === 'string' ? props.label : ''}
                position={{ x: 0, y: 0 }}
                referenceElement={null}
                onSelect={handleIntellisenseSelect}
                onClose={handleCloseIntellisense}
                filterCategoryTypes={['conditions']}
              />
            </div>,
            document.body
          )}
          {/* Overlay EdgeConditionSelector */}
          {showConditionSelector && createPortal(
            <EdgeConditionSelector
              position={conditionSelectorPos}
              onSelectCondition={handleSelectCondition}
              onSelectUnconditioned={handleSelectUnconditioned}
              onClose={handleCloseSelector}
            />,
            document.body
          )}
        </g>
      )}
      {/* Se la edge NON ha una label, mostra il bottone centrale per aggiungere condizione SOLO se selezionata */}
      {!(props.data?.label || props.label) && props.selected && (
        <g>
          <foreignObject
            x={midX - 20}
            y={midY - 20}
            width={40}
            height={40}
            style={{ overflow: 'visible', pointerEvents: 'none' }}
          >
            <div
              style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}
            >
              <button
                ref={gearButtonRef}
                onClick={e => {
                  e.stopPropagation();
                  // Posiziona l'intellisense subito sotto l'ingranaggio
                  if (gearButtonRef.current) {
                    const rect = gearButtonRef.current.getBoundingClientRect();
                    handleOpenIntellisense(rect.left + window.scrollX, rect.bottom + window.scrollY + 2);
                  } else {
                    // fallback: centro SVG
                    const svg = document.querySelector('svg');
                    if (svg) {
                      const pt = svg.createSVGPoint();
                      pt.x = midX;
                      pt.y = midY + 24;
                      const ctm = svg.getScreenCTM();
                      if (ctm) {
                        const transformed = pt.matrixTransform(ctm);
                        handleOpenIntellisense(transformed.x, transformed.y);
                      }
                    }
                  }
                }}
                className="group w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 border border-gray-300 shadow transition-all hover:bg-gray-300 hover:scale-110 hover:shadow-lg focus:outline-none"
                title="Aggiungi condizione"
                style={{ transition: 'all 0.15s cubic-bezier(.4,2,.6,1)', boxShadow: '0 2px 8px rgba(139,92,246,0.10)' }}
              >
                <Settings className="w-3 h-3 text-gray-500 group-hover:text-gray-700 transition-colors" />
              </button>
            </div>
          </foreignObject>
        </g>
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
            background: "transparent", // Sfondo trasparente
            borderRadius: 6,
            padding: 0, // Nessun padding
            boxShadow: "none" // Nessuna ombra
          }}
            onMouseEnter={() => setTrashHovered(true)}
            onMouseLeave={() => setTrashHovered(false)}
          >
            <span title="Elimina il link">
            <Trash2
              size={16}
              color={trashHovered ? "#dc2626" : "#888"}
              style={{ cursor: "pointer", opacity: 0.85, transition: 'color 0.15s', background: 'transparent', borderRadius: 0, padding: 0 }}
              onClick={e => { e.stopPropagation(); handleDelete(id); }}
              aria-label="Elimina collegamento"
              tabIndex={0}
              role="button"
            />
            </span>
          </div>
        </foreignObject>
      )}
    </g>
  );
};

export default CustomEdge; 