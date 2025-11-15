import React, { useState } from 'react';
import { IntellisenseItem as IntellisenseItemType, IntellisenseResult } from './IntellisenseTypes';
import { highlightMatches } from './IntellisenseSearch';
import { Circle, Ear, CheckCircle2, Megaphone, Trash2 } from 'lucide-react';
import { SIDEBAR_TYPE_COLORS, SIDEBAR_TYPE_ICONS, SIDEBAR_ICON_COMPONENTS } from '../Sidebar/sidebarTheme';
import { getAgentActIconColor } from '../../utils/agentActIconColor';

interface IntellisenseItemProps {
  result: IntellisenseResult;
  isSelected: boolean;
  isFromAI?: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onDelete?: (item: IntellisenseItemType) => void; // ✅ Callback per cancellazione
  fontSize?: string; // ✅ Font size dinamico
}

export const IntellisenseItem: React.FC<IntellisenseItemProps> = ({
  result,
  isSelected,
  isFromAI = false,
  onClick,
  onMouseEnter,
  onDelete,
  fontSize = '14px' // ✅ Default font size
}) => {
  const { item, matches } = result;
  const [isHovered, setIsHovered] = useState(false);
  const [isTrashHovered, setIsTrashHovered] = useState(false);

  // ✅ Log rimosso per evitare spam

  // Find matches for name and description
  const nameMatches = matches?.filter(match => match.key === 'name');
  const descriptionMatches = matches?.filter(match => match.key === 'description');

  const iconKey = item.iconComponent ? undefined : SIDEBAR_TYPE_ICONS[item.categoryType as string];
  const IconFromSidebar = iconKey ? SIDEBAR_ICON_COMPONENTS[iconKey] : null;
  // Foreground color: use getAgentActIconColor for Agent Acts with mode="DataRequest"
  const baseColor = (item.categoryType === 'agentActs')
    ? ((item as any)?.mode === 'DataRequest' ? getAgentActIconColor(item as any) : ((item as any)?.mode === 'DataConfirmation' ? '#f59e0b' : '#22c55e'))
    : (SIDEBAR_TYPE_COLORS[item.categoryType as string]?.color);
  const foreColor = (item.categoryType === 'agentActs')
    ? (baseColor || item.textColor || item.color || undefined)
    : (item.textColor || item.color || baseColor || undefined);

  // Debug logging removed to prevent excessive console output

  // ✅ Calcola padding proporzionale al font size
  const fontSizeNum = parseFloat(fontSize) || 14;
  const paddingV = fontSizeNum * 0.35; // Padding verticale (35% del font size)
  const paddingH = fontSizeNum * 0.5; // Padding orizzontale (50% del font size)

  // ✅ Mostra cestino solo per condizioni
  const isCondition = item.categoryType === 'conditions' || item.kind === 'condition';
  const showDelete = isCondition && isHovered && onDelete;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(item);
    }
  };

  return (
    <div
      className={`
        flex items-start cursor-pointer rounded-md transition-all duration-150
        ${isSelected ? 'bg-amber-200 text-black border-2 border-amber-500' : 'border border-transparent'}
      `}
      style={{
        padding: `${paddingV}px ${paddingH}px`,
        background: isSelected ? undefined : (item.bgColor || item.uiColor || (item.categoryType && SIDEBAR_TYPE_COLORS[item.categoryType]?.light) || undefined),
        width: 'max-content', // ✅ Ogni item ha la sua larghezza naturale
        minWidth: '100%',     // ✅ Almeno quanto il parent
      }}
      onClick={onClick}
      onMouseEnter={() => {
        setIsHovered(true);
        onMouseEnter();
      }}
      onMouseLeave={() => setIsHovered(false)}
      data-intellisense-item
    >
      {/* Icon */}
      <div className="mr-1 mt-0.5 flex-shrink-0">
        {(() => {
          const iconSize = fontSizeNum * 0.75; // ✅ Icona proporzionale al font (75% del font size)
          const iconStyle = { color: foreColor, width: `${iconSize}px`, height: `${iconSize}px` };

          return item.iconComponent ? (
            <item.iconComponent style={iconStyle} />
          ) : (item.categoryType === 'agentActs') ? (
            ((item as any)?.mode === 'DataRequest') ? (
              <Ear style={iconStyle} />
            ) : ((item as any)?.mode === 'DataConfirmation') ? (
              <CheckCircle2 style={iconStyle} />
            ) : (
              <Megaphone style={iconStyle} />
            )
          ) : IconFromSidebar ? (
            <IconFromSidebar style={{ ...iconStyle, color: foreColor || '#94a3b8' }} />
          ) : (
            <Circle style={{ ...iconStyle, color: '#9ca3af' }} />
          );
        })()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Label principale con tooltip se description */}
        <div
          className="font-normal whitespace-nowrap overflow-hidden text-ellipsis"
          style={{
            color: isSelected ? '#111' : (foreColor as any),
            fontSize: fontSize, // ✅ Usa font size dinamico
            lineHeight: 1.2
          }}
          title={item.description && item.description.trim() !== '' ? item.description : undefined}
        >
          {highlightMatches(item.label || item.name, nameMatches)}
        </div>

        {/* AI Badge */}
        {isFromAI && (
          <div className="mt-1">
            <span
              className="inline-flex items-center px-1 py-0.5 rounded-full font-medium bg-slate-600 text-white"
              style={{ fontSize: `calc(${fontSize} * 0.75)`, lineHeight: 1 }} // ✅ Badge proporzionale (75% del font size)
            >
              Suggerito AI
            </span>
          </div>
        )}
      </div>

      {/* ✅ Cestino per cancellare (solo per condizioni, visibile su hover) */}
      {showDelete && (
        <div
          className="flex-shrink-0 ml-2 flex items-center"
          onMouseEnter={() => setIsTrashHovered(true)}
          onMouseLeave={() => setIsTrashHovered(false)}
        >
          <button
            onClick={handleDelete}
            className="p-1 rounded transition-colors"
            style={{
              color: isTrashHovered ? '#dc2626' : '#9ca3af', // ✅ Rosso su hover, grigio di default
              cursor: 'pointer'
            }}
            title="Elimina condizione"
          >
            <Trash2 size={fontSizeNum * 0.75} /> {/* ✅ Icona proporzionale (75% del font size) */}
          </button>
        </div>
      )}
    </div>
  );
};