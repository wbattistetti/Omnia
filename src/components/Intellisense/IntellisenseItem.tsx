import React from 'react';
import { IntellisenseItem as IntellisenseItemType, IntellisenseResult } from './IntellisenseTypes';
import { highlightMatches } from './IntellisenseSearch';

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
        ${isSelected 
          ? 'bg-slate-700 shadow-md' 
          : 'hover:bg-slate-700/50'
        }
      `}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      {/* Icon */}
      <div className="mr-3 mt-0.5 flex-shrink-0">
        <span className="text-slate-400">
          {item.icon}
        </span>
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Description (o name se manca) con highlighting */}
        <div className="font-normal text-sm text-white mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
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