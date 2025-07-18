import React from 'react';
import { IntellisenseItem as IntellisenseItemType, IntellisenseResult } from './IntellisenseTypes';
import { highlightMatches } from './IntellisenseSearch';
import { Circle } from 'lucide-react';

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
  
  return (
    <div
      className={`
        flex items-start p-3 cursor-pointer rounded-lg transition-all duration-150
        ${isSelected ? 'border border-black' : 'border border-transparent'}
      `}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      style={{ background: item.bgColor || item.uiColor || undefined }}
    >
      {/* Icon */}
      <div className="mr-3 mt-0.5 flex-shrink-0">
        {(!item.userActs && item.categoryType === 'agentActs') ? (
          <Circle className="w-4 h-4 text-gray-400" />
        ) : (
          <span className="text-slate-400">
            {item.icon}
          </span>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Description (o name se manca) con highlighting */}
        <div className="font-normal text-sm mb-1 whitespace-nowrap overflow-hidden text-ellipsis"
             style={{ color: item.textColor || undefined }}>
          {item.description
            ? highlightMatches(item.description, descriptionMatches)
            : highlightMatches(item.name, nameMatches)
          }
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