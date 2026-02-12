import React from 'react';
import { Settings, Trash2 } from 'lucide-react';

export interface EdgeControlsProps {
  showGear: boolean;
  showTrash: boolean;
  midPointSvg: { x: number; y: number };
  sourceX: number;
  sourceY: number;
  sourcePosition: string;
  onGearClick?: (e: React.MouseEvent) => void;
  onTrashClick?: (e: React.MouseEvent) => void;
  onTrashMouseEnter?: () => void;
  onTrashMouseLeave?: () => void;
  trashHovered?: boolean;
}

/**
 * Edge controls component (gear + trash)
 * Handles precise positioning using SVG coordinates
 */
export const EdgeControls: React.FC<EdgeControlsProps> = ({
  showGear,
  showTrash,
  midPointSvg,
  sourceX,
  sourceY,
  sourcePosition,
  onGearClick,
  onTrashClick,
  onTrashMouseEnter,
  onTrashMouseLeave,
  trashHovered = false,
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
      {/* Gear button - shown when no label and edge is selected */}
      {showGear && (
        <foreignObject
          x={midPointSvg.x - 20}
          y={midPointSvg.y - 20}
          width={40}
          height={40}
          style={{ overflow: 'visible', pointerEvents: 'none' }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
            }}
          >
            <button
              onClick={onGearClick}
              className="group w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 border border-gray-300 shadow transition-all hover:bg-gray-300 hover:scale-110 hover:shadow-lg focus:outline-none"
              title="Aggiungi condizione"
              style={{
                transition: 'all 0.15s cubic-bezier(.4,2,.6,1)',
                boxShadow: '0 2px 8px rgba(139,92,246,0.10)',
              }}
            >
              <Settings className="w-3 h-3 text-gray-500 group-hover:text-gray-700 transition-colors" />
            </button>
          </div>
        </foreignObject>
      )}

      {/* Trash button - shown when edge is selected */}
      {showTrash && (
        <foreignObject
          x={trashX}
          y={trashY}
          width={24}
          height={24}
          style={{ overflow: 'visible', pointerEvents: 'none' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'auto',
              background: 'transparent',
              borderRadius: 6,
              padding: 0,
              boxShadow: 'none',
            }}
            onMouseEnter={onTrashMouseEnter}
            onMouseLeave={onTrashMouseLeave}
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
