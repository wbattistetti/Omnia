import React from 'react';

interface IntellisenseCategoryHeaderProps {
  name: string;
  icon?: React.ReactNode;
  color?: string;
  itemCount: number;
}

export const IntellisenseCategoryHeader: React.FC<IntellisenseCategoryHeaderProps> = ({
  name,
  icon,
  color,
  itemCount
}) => {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-slate-700 border-b border-slate-600 sticky top-0 z-10">
      <div className="flex items-center">
        {icon && (
          <span className="mr-2 text-slate-400">
            {icon}
          </span>
        )}
        <span className="text-sm font-semibold text-white uppercase tracking-wide">
          {name}
        </span>
      </div>
      <span className="text-xs text-slate-300 bg-slate-600 px-2 py-1 rounded-full">
        {itemCount}
      </span>
    </div>
  );
};