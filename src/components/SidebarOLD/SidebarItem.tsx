import React, { useState } from 'react';
import { Trash2, FileText } from 'lucide-react';
import { EditableText } from './EditableText';
import { ProjectEntityItem } from '../../types/project';
import { useSidebarTheme } from './SidebarThemeContext';

interface SidebarItemProps {
  item: ProjectEntityItem;
  onUpdate: (updates: Partial<ProjectEntityItem>) => void;
  onDelete: () => void;
}

export const SidebarItem: React.FC<SidebarItemProps & { entityType?: string; textColor?: string; bgColor?: string }> = ({ item, onUpdate, onDelete, entityType, textColor, bgColor }) => {
  const [isHovered, setIsHovered] = useState(false);
  const { colors, fontSizes, icons } = useSidebarTheme();
  return (
    <div 
      className="ml-4 mb-2 p-2 rounded-lg transition-colors group"
      style={{ background: bgColor || colors[entityType]?.light }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center mb-1">
            {(() => {
              const Icon = icons[entityType];
              return <Icon style={{ fontSize: `${fontSizes.icon}em`, color: colors[entityType]?.main }} className="mr-2 flex-shrink-0" />;
            })()}
            <EditableText
              value={item.name}
              onSave={(name) => onUpdate({ name })}
              placeholder="Item name"
              className="font-normal"
              style={{ fontSize: `${fontSizes.item}em`, color: textColor || colors[entityType]?.main }}
              showEditIcon={false}
              {...(item.description ? { title: item.description } : {})}
            />
          </div>
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