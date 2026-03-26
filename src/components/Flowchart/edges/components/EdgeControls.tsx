import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';

export interface EdgeControlsProps {
  /** Link senza label: mostra matita per scrivere label/condizione (non ingranaggio). */
  showPencil: boolean;
  showTrash: boolean;
  midPointSvg: { x: number; y: number };
  sourceX: number;
  sourceY: number;
  sourcePosition: string;
  onPencilClick?: (e: React.MouseEvent) => void;
  onTrashClick?: (e: React.MouseEvent) => void;
  onTrashMouseEnter?: () => void;
  onTrashMouseLeave?: () => void;
  trashHovered?: boolean;
  /** Mantiene l’hover sul link mentre il puntatore va dal tratto alla matita/cestino. */
  onControlsZoneMouseEnter?: () => void;
  onControlsZoneMouseLeave?: () => void;
}

/**
 * Controlli sul link (matita per label quando manca, cestino).
 * Posizionamento in coordinate SVG.
 */
export const EdgeControls: React.FC<EdgeControlsProps> = ({
  showPencil,
  showTrash,
  midPointSvg,
  sourceX,
  sourceY,
  sourcePosition,
  onPencilClick,
  onTrashClick,
  onTrashMouseEnter,
  onTrashMouseLeave,
  trashHovered = false,
  onControlsZoneMouseEnter,
  onControlsZoneMouseLeave,
}) => {
  // Calculate trash position offset based on source position (SVG coordinates)
  const getTrashOffset = () => {
    switch (sourcePosition) {
      case 'left':
        return { x: -36, y: -12 };
      case 'right':
        return { x: 12, y: -12 };
      case 'top':
        return { x: -12, y: -36 };
      case 'bottom':
        return { x: -12, y: 12 };
      default:
        return { x: -12, y: -12 };
    }
  };

  const trashOffset = getTrashOffset();
  const trashX = sourceX + trashOffset.x;
  const trashY = sourceY + trashOffset.y;

  return (
    <>
      {showPencil && (
        <foreignObject
          x={midPointSvg.x - 24}
          y={midPointSvg.y - 24}
          width={48}
          height={48}
          style={{ overflow: 'visible', pointerEvents: 'none' }}
        >
          <div
            onMouseEnter={() => onControlsZoneMouseEnter?.()}
            onMouseLeave={() => onControlsZoneMouseLeave?.()}
            style={{
              width: 48,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
            }}
          >
            <button
              type="button"
              onClick={onPencilClick}
              className="group w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 border border-gray-300 shadow transition-all hover:bg-gray-300 hover:scale-110 hover:shadow-lg focus:outline-none"
              title="Scrivi label"
              style={{
                transition: 'all 0.15s cubic-bezier(.4,2,.6,1)',
                boxShadow: '0 2px 8px rgba(139,92,246,0.10)',
              }}
            >
              <Pencil className="w-3 h-3 text-gray-500 group-hover:text-gray-700 transition-colors" aria-hidden />
            </button>
          </div>
        </foreignObject>
      )}

      {/* Trash button - shown when edge is selected */}
      {showTrash && (
        <foreignObject
          x={trashX - 4}
          y={trashY - 4}
          width={32}
          height={32}
          style={{ overflow: 'visible', pointerEvents: 'none' }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
              background: 'transparent',
              borderRadius: 6,
              padding: 0,
              boxShadow: 'none',
            }}
            onMouseEnter={() => {
              onControlsZoneMouseEnter?.();
              onTrashMouseEnter?.();
            }}
            onMouseLeave={() => {
              onControlsZoneMouseLeave?.();
              onTrashMouseLeave?.();
            }}
          >
            <span title="Elimina il link">
              <Trash2
                size={16}
                color={trashHovered ? '#dc2626' : '#888'}
                style={{
                  cursor: 'pointer',
                  opacity: 0.85,
                  transition: 'color 0.15s',
                  background: 'transparent',
                  borderRadius: 0,
                  padding: 0,
                }}
                onClick={onTrashClick}
                aria-label="Elimina collegamento"
                tabIndex={0}
                role="button"
              />
            </span>
          </div>
        </foreignObject>
      )}
    </>
  );
};
