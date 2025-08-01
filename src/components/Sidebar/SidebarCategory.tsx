import React, { useState } from 'react';
import ItemEditor from './ItemEditor';
import DeleteConfirmation from './DeleteConfirmation';
import SidebarItem from './SidebarItem';
import { Pencil, Trash2 } from 'lucide-react';
import { ProjectCategory, ProjectEntityItem, EntityType } from '../../types/project';

interface SidebarCategoryProps {
  category: ProjectCategory;
  entityType: EntityType;
  onAddItem: (name: string, description?: string) => void;
  onDeleteCategory: () => void;
  onUpdateCategory: (updates: Partial<ProjectCategory>) => void;
  onDeleteItem: (itemId: string) => void;
  onUpdateItem: (itemId: string, updates: Partial<ProjectEntityItem>) => void;
}

const SidebarCategory: React.FC<SidebarCategoryProps> = ({
  category,
  onUpdateCategory,
  onDeleteCategory,
  onAddItem,
  onDeleteItem,
  onUpdateItem,
  entityType,
}) => {
  const [editing, setEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [adding, setAdding] = useState(false);

  return (
    <div className="mb-4 px-1 py-1 rounded">
      {/* Category row: only this div controls hover for icons */}
      <div
        className="flex items-center gap-1 min-h-[32px]"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setShowDelete(false); }}
      >
        {editing ? (
          <ItemEditor
            value={category.name}
            onConfirm={(name) => {
              onUpdateCategory({ name });
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
            placeholder="Edit category..."
            className="font-semibold"
          />
        ) : (
          <>
            <span className="text-sm font-semibold text-gray-100 truncate">{category.name}</span>
            {hovered && (
              <span className="flex items-center gap-1 ml-1">
                <button
                  className="p-1 text-gray-400 hover:text-blue-400"
                  title="Modifica"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  className="p-1 text-red-500 hover:text-red-700"
                  title="Elimina categoria"
                  onClick={() => setShowDelete(true)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  className="p-1 text-blue-500 hover:text-blue-700 text-xs font-medium"
                  style={{ minWidth: 0 }}
                  onClick={() => setAdding(true)}
                >
                  Aggiungi voce
                </button>
              </span>
            )}
            {showDelete && (
              <DeleteConfirmation
                onConfirm={onDeleteCategory}
                triggerClass="hidden"
                icon={null}
              />
            )}
          </>
        )}
      </div>
      {/* Add item input (immediately below category header) */}
      {adding && (
        <div className="ml-4 mt-1">
          <ItemEditor
            value=""
            onConfirm={(name) => {
              onAddItem(name);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
            placeholder="Nuova voce..."
          />
        </div>
      )}
      {/* Items */}
      <div className="ml-4 mt-1">
        {category.items.map((item) => (
          <SidebarItem
            key={item.id}
            item={item}
            onUpdate={(updates) => onUpdateItem(item.id, updates)}
            onDelete={() => onDeleteItem(item.id)}
            entityType={entityType}
          />
        ))}
      </div>
    </div>
  );
};

export default SidebarCategory;