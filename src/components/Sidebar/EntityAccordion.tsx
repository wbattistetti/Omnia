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
  onBuildFromItem?: (item: ProjectEntityItem) => void;
  hasDDTFor?: (label: string) => boolean;
  onCreateDDT?: (categoryId: string, itemId: string, newDDT: any) => void;
  onOpenEmbedded?: (categoryId: string, itemId: string) => void;
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
  onBuildFromItem,
  hasDDTFor,
  onCreateDDT,
  onOpenEmbedded,
}) => {
  const [adding, setAdding] = useState(false);

  return (
    <SidebarEntityAccordion
      title={
        <span className="flex items-center gap-2">
          {title}
          {entityKey === 'agentActs' && (
            (() => {
              const totals = (data || []).reduce((acc: { total: number; built: number }, cat: any) => {
                const items = Array.isArray(cat?.items) ? cat.items : [];
                acc.total += items.length;
                acc.built += items.filter((it: any) => Boolean(it?.ddt)).length;
                return acc;
              }, { total: 0, built: 0 });
              return (
                <span
                  className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: 'transparent',
                    color: '#ffffff',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.45)'
                  }}
                  title="# built / total"
                >
                  #{totals.built}/{totals.total}
                </span>
              );
            })()
          )}
          {isOpen && (
            <button
              className="ml-2 px-1.5 py-0.5 text-[10px] rounded-md border transition-colors"
              onClick={e => {
                e.stopPropagation();
                setAdding(true);
              }}
              style={{
                lineHeight: 1,
                background: 'rgba(255,255,255,0.12)',
                color: 'var(--sidebar-content-text, #ffffff)',
                borderColor: 'rgba(255,255,255,0.65)'
              }}
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
          onBuildFromItem={onBuildFromItem}
          hasDDTFor={hasDDTFor}
          onAddItem={name => onAddItem(category.id, name)}
          onDeleteCategory={() => onDeleteCategory(category.id)}
          onUpdateCategory={updates => onUpdateCategory(category.id, updates)}
          onDeleteItem={itemId => onDeleteItem(category.id, itemId)}
          onUpdateItem={(itemId, updates) => onUpdateItem(category.id, itemId, updates)}
          onCreateDDT={(itemId, newDDT) => onCreateDDT && onCreateDDT(category.id, itemId, newDDT)}
          onOpenEmbedded={(itemId) => onOpenEmbedded && onOpenEmbedded(category.id, itemId)}
        />
      ))}
    </SidebarEntityAccordion>
  );
};

export default EntityAccordion;