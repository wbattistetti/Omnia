import React from 'react';
import { IntellisenseItem as IntellisenseItemType, IntellisenseResult } from './IntellisenseTypes';
import { highlightMatches } from './IntellisenseSearch';
import { Circle, Ear, CheckCircle2, Megaphone } from 'lucide-react';
import { SIDEBAR_TYPE_COLORS, SIDEBAR_TYPE_ICONS, SIDEBAR_ICON_COMPONENTS } from '../Sidebar/sidebarTheme';
import { getAgentActIconColor } from '../../utils/agentActIconColor';

interface IntellisenseItemProps {
  result: IntellisenseResult;
  isSelected: boolean;
  isFromAI?: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

export const IntellisenseItem: React.FC<IntellisenseItemProps> = ({
  result,
  isSelected,
  isFromAI = false,
  onClick,
  onMouseEnter
}) => {
  const { item, matches } = result;
  
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

  return (
    <div
      className={`
        flex items-start p-3 cursor-pointer rounded-lg transition-all duration-150
        ${isSelected ? 'border border-black' : 'border border-transparent'}
      `}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      style={{ background: item.bgColor || item.uiColor || (item.categoryType && SIDEBAR_TYPE_COLORS[item.categoryType]?.light) || undefined }}
    >
      {/* Icon */}
      <div className="mr-3 mt-0.5 flex-shrink-0">
        {item.iconComponent ? (
          <item.iconComponent className="w-4 h-4" style={{ color: foreColor }} />
        ) : (item.categoryType === 'agentActs') ? (
          ((item as any)?.mode === 'DataRequest') ? (
            <Ear className="w-4 h-4" style={{ color: foreColor }} />
          ) : ((item as any)?.mode === 'DataConfirmation') ? (
            <CheckCircle2 className="w-4 h-4" style={{ color: foreColor }} />
          ) : (
            <Megaphone className="w-4 h-4" style={{ color: foreColor }} />
          )
        ) : IconFromSidebar ? (
          <IconFromSidebar className="w-4 h-4" style={{ color: foreColor || '#94a3b8' }} />
        ) : (
          <Circle className="w-4 h-4 text-gray-400" />
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Label principale con tooltip se description */}
        <div
          className="font-normal text-sm mb-1 whitespace-nowrap overflow-hidden text-ellipsis"
          style={{ color: foreColor }}
          title={item.description && item.description.trim() !== '' ? item.description : undefined}
        >
          {highlightMatches(item.label || item.name, nameMatches)}
        </div>
        
        {/* AI Badge */}
        {isFromAI && (
          <div className="mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-600 text-white">
              Suggerito AI
            </span>
          </div>
        )}
      </div>
    </div>
  );
};