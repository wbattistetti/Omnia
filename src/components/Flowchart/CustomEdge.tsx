import React, { useState, useEffect, useRef } from 'react';
import { EdgeProps, getBezierPath } from 'reactflow';
import { Pencil, Trash2, Link, Link2Off as LinkOff, Settings } from 'lucide-react';
import { normalizeMarkerEnd } from '../../utils/markerUtils';
import { IntellisenseMenu } from '../Intellisense/IntellisenseMenu';
import { EdgeConditionSelector } from './EdgeConditionSelector';
import { createPortal } from 'react-dom';
import { useReactFlow } from 'reactflow';

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
  // Ref e stato per misurare la caption
  const captionRef = useRef<HTMLDivElement>(null);
  const [captionSize, setCaptionSize] = useState({ width: 0, height: 0 });
  const pathRef = useRef<SVGPathElement>(null);
  const [screenPoint, setScreenPoint] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const label = props.data?.label || props.label;
  const [midPoint, setMidPoint] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const reactFlowInstance = useReactFlow();
  const [zoom, setZoom] = useState(1);

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

  // Midpoint for icons (usato solo per fallback)
  // const midX = (sourceX + targetX) / 2;
  // const midY = (sourceY + targetY) / 2;

  // Icon size and box
  const ICON_SIZE = 18;
  const ICON_BOX = 28;

  // Altezza precisa della caption
  const captionHeight = 24;

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
    if (captionRef.current) {
      const rect = captionRef.current.getBoundingClientRect();
      setCaptionSize({ width: rect.width, height: rect.height });
    }
  }, [props.data?.label, props.label]);

  useEffect(() => {
    if (pathRef.current) {
      const pathLength = pathRef.current.getTotalLength();
      const point = pathRef.current.getPointAtLength(pathLength / 2);
      const svg = pathRef.current.ownerSVGElement;
      if (svg && svg.getScreenCTM) {
        const ctm = svg.getScreenCTM();
        if (ctm) {
          const pt = svg.createSVGPoint();
          pt.x = point.x;
          pt.y = point.y;
          const transformed = pt.matrixTransform(ctm);
          setScreenPoint({ x: transformed.x, y: transformed.y });
        }
      }
    }
  }, [edgePath, label]);

  // Aggiorna la posizione della label anche su zoom/pan/drag
  useEffect(() => {
    if (!reactFlowInstance) return;
    // Ricalcola la posizione ogni volta che cambia viewport
    const updateLabelPosition = () => {
      if (pathRef.current) {
        const pathLength = pathRef.current.getTotalLength();
        const point = pathRef.current.getPointAtLength(pathLength / 2);
        const svg = pathRef.current.ownerSVGElement;
        if (svg && svg.getScreenCTM) {
          const ctm = svg.getScreenCTM();
          if (ctm) {
            const pt = svg.createSVGPoint();
            pt.x = point.x;
            pt.y = point.y;
            const transformed = pt.matrixTransform(ctm);
            setScreenPoint({ x: transformed.x, y: transformed.y });
          }
        }
      }
    };
    // Aggiorna subito
    updateLabelPosition();
    // Polling: aggiorna ogni 100ms (workaround universale)
    const interval = setInterval(updateLabelPosition, 100);
    return () => clearInterval(interval);
  }, [reactFlowInstance, edgePath, label]);

  // Aggiorna lo zoom ogni volta che cambia la viewport
  useEffect(() => {
    if (!reactFlowInstance) return;
    const updateZoom = () => {
      setZoom(reactFlowInstance.getZoom ? reactFlowInstance.getZoom() : 1);
    };
    updateZoom();
    // Polling: aggiorna ogni 100ms (workaround universale)
    const interval = setInterval(updateZoom, 100);
    return () => clearInterval(interval);
  }, [reactFlowInstance]);

  return (
    <>
      <g
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ pointerEvents: 'all' }}
      >
        {/* Edge path */}
        <path
          id={id}
          ref={pathRef}
          style={{
            ...style,
            strokeDasharray: undefined,
            stroke: trashHovered ? '#dc2626' : (style.stroke || '#8b5cf6'),
            transition: 'stroke 0.15s',
          }}
          className="react-flow__edge-path"
          d={edgePath}
          markerEnd={markerEnd ? `url(#${getNormalizedMarkerEnd(markerEnd)})` : undefined}
        />
        {/* Label/icone condizione al centro della linea */}
        {/* Mostra label e icone SEMPRE se la edge ha una label */}
        {/* (Label DOM overlay gestita sotto con portal) */}
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
        {/* Se la edge NON ha una label, mostra il bottone centrale per aggiungere condizione SOLO se selezionata */}
        {!(props.data?.label || props.label) && props.selected && (
          <g>
            <foreignObject
              x={midPoint.x - 20}
              y={midPoint.y - 20}
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
                        pt.x = midPoint.x;
                        pt.y = midPoint.y + 24;
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
      {label && createPortal(
        <div
          onMouseEnter={() => setLabelHovered(true)}
          onMouseLeave={() => setLabelHovered(false)}
          style={{
            position: 'absolute',
            left: screenPoint.x,
            top: screenPoint.y,
            transform: 'translate(-50%, -50%)',
            background: 'transparent',
            border: 'none',
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: 12 * zoom,
            pointerEvents: 'auto',
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(139,92,246,0.10)',
            minWidth: 30,
            minHeight: 18,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'text',
            whiteSpace: 'pre',
            gap: 4,
          }}
        >
          <span>{label}</span>
          {labelHovered && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: 6 }}>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#8b5cf6',
                  width: 18 * zoom,
                  height: 18 * zoom,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Modifica label"
                onClick={e => { e.stopPropagation(); /* TODO: azione edit */ }}
              >
                <Pencil size={14 * zoom} />
              </button>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#888',
                  width: 18 * zoom,
                  height: 18 * zoom,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Rendi unconduitioned"
                onClick={e => { e.stopPropagation(); if (typeof handleUncondition === 'function') handleUncondition(); }}
              >
                <LinkOff size={14 * zoom} />
              </button>
            </span>
          )}
        </div>,
        document.body
      )}
    </>
  );
};

export default CustomEdge; 