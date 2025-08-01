import React, { useState } from 'react';
import SidebarEntityAccordion from './SidebarEntityAccordion';
import SidebarCategory from './SidebarCategory';
import { EntityType, Category, ProjectEntityItem } from '../../types/project';
import ItemEditor from './ItemEditor';

interface EntityAccordionProps {
  entityKey: EntityType;
  title: string;
  icon: React.ReactNode;
  data: Category[];
  isOpen: boolean;
  onToggle: () => void;
  onAddCategory: (name: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  onUpdateCategory: (categoryId: string, updates: Partial<Category>) => void;
  onAddItem: (categoryId: string, name: string, description?: string) => void;
  onDeleteItem: (categoryId: string, itemId: string) => void;
  onUpdateItem: (categoryId: string, itemId: string, updates: Partial<ProjectEntityItem>) => void;
}

const EntityAccordion: React.FC<EntityAccordionProps> = ({
  entityKey,
  title,
  icon,
  data,
  isOpen,
  onToggle,
  onAddCategory,
  onDeleteCategory,
  onUpdateCategory,
  onAddItem,
  onDeleteItem,
  onUpdateItem,
}) => {
  const [adding, setAdding] = useState(false);

  return (
    <SidebarEntityAccordion
      title={
        <span className="flex items-center gap-2">
          {title}
          {isOpen && (
            <button
              className="ml-2 px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              onClick={e => {
                e.stopPropagation();
                setAdding(true);
              }}
              style={{ fontSize: '0.85em', lineHeight: 1 }}
            >
              Aggiungi categoria
            </button>
          )}
        </span>
      }
      icon={icon}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      {adding && (
        <div className="mb-2">
          <ItemEditor
            value=""
            onConfirm={name => {
              onAddCategory(name);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
            placeholder="Nuova categoria..."
          />
        </div>
      )}
      {data.map(category => (
        <SidebarCategory
          key={category.id}
          category={category}
          entityType={entityKey}
          onAddItem={name => onAddItem(category.id, name)}
          onDeleteCategory={() => onDeleteCategory(category.id)}
          onUpdateCategory={updates => onUpdateCategory(category.id, updates)}
          onDeleteItem={itemId => onDeleteItem(category.id, itemId)}
          onUpdateItem={(itemId, updates) => onUpdateItem(category.id, itemId, updates)}
        />
      ))}
    </SidebarEntityAccordion>
  );
};

export default EntityAccordion;