import React, { useState } from 'react';
import { Trash2, FileText } from 'lucide-react';
import { EditableText } from './EditableText';
import { ProjectEntityItem } from '../../types/project';

interface SidebarItemProps {
  item: ProjectEntityItem;
  onUpdate: (updates: Partial<ProjectEntityItem>) => void;
  onDelete: () => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({ item, onUpdate, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="ml-4 mb-2 p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center mb-1">
            <FileText className="w-3 h-3 text-slate-400 mr-2 flex-shrink-0" />
            <EditableText
              value={item.name}
              onSave={(name) => onUpdate({ name })}
              placeholder="Item name"
              className="font-medium text-sm"
              showEditIcon={false}
            />
          </div>
          {item.description && (
            <div className="ml-5">
              <EditableText
                value={item.description}
                onSave={(description) => onUpdate({ description })}
                placeholder="Add description..."
                className="text-xs text-slate-400"
                showEditIcon={false}
              />
            </div>
          )}
        </div>
        
        {isHovered && (
          <button
            onClick={onDelete}
            className="ml-2 p-1 text-red-400 hover:text-red-300 transition-colors opacity-0 group-hover:opacity-100"
            title="Delete item"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};