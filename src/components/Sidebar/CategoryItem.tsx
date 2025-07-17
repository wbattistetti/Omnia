import React, { useState } from 'react';
import { Trash2, Folder, FolderOpen } from 'lucide-react';
import { SidebarItem } from './SidebarItem';
import { AddButton } from './AddButton';
import { EditableText } from './EditableText';
import { Category, EntityType, ProjectEntityItem } from '../../types/project';

interface CategoryItemProps {
  category: Category;
  entityType: EntityType;
  onAddItem: (name: string, description?: string) => void;
  onDeleteCategory: () => void;
  onUpdateCategory: (updates: Partial<Category>) => void;
  onDeleteItem: (itemId: string) => void;
  onUpdateItem: (itemId: string, updates: Partial<ProjectEntityItem>) => void;
}

export const CategoryItem: React.FC<CategoryItemProps> = ({
  category,
  entityType,
  onAddItem,
  onDeleteCategory,
  onUpdateCategory,
  onDeleteItem,
  onUpdateItem
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const handleAddItem = (name: string) => {
    onAddItem(name, '');
  };

  return (
    <div className="mb-3">
      <div 
        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-700/30 transition-colors group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div 
          className="flex items-center flex-1 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-blue-400 mr-2" />
          ) : (
            <Folder className="w-4 h-4 text-blue-400 mr-2" />
          )}
          <EditableText
            value={category.name}
            onSave={(name) => onUpdateCategory({ name })}
            placeholder="Category name"
            className="font-medium text-slate-200"
            showEditIcon={false}
          />
          <span className="ml-2 text-xs text-slate-500">
            ({category.items.length})
          </span>
        </div>
        
        {isHovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteCategory();
            }}
            className="p-1 text-red-400 hover:text-red-300 transition-colors opacity-0 group-hover:opacity-100"
            title="Delete category"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="mt-2">
          {category.items.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              onUpdate={(updates) => onUpdateItem(item.id, updates)}
              onDelete={() => onDeleteItem(item.id)}
            />
          ))}
          
          <div className="ml-4 mt-2">
            <AddButton
              label="Nuova Voce"
              onAdd={handleAddItem}
              placeholder="Enter item name..."
            />
          </div>
        </div>
      )}
    </div>
  );
};