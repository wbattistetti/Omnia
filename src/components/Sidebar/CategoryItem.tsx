import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { SidebarItem } from './SidebarItem';
import { AddButton } from './AddButton';
import { EditableText } from './EditableText';
import { Category, EntityType, ProjectEntityItem } from '../../types/project';
import { useSidebarTheme } from './SidebarThemeContext';

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
  const [isAdding, setIsAdding] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleAddItem = (name: string) => {
    onAddItem(name, '');
    setIsAdding(false);
    setNewItemName("");
  };

  const { colors, icons, fontSizes } = useSidebarTheme();
  return (
    <div className="mb-3" style={{ background: colors[entityType]?.light, borderRadius: 12, padding: 2 }}>
      <div 
        className="flex items-center justify-between p-2 rounded-lg transition-colors group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div 
          className="flex items-center flex-1 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {(() => {
            const Icon = icons[entityType];
            return <Icon style={{ fontSize: `${fontSizes.icon}em`, color: colors[entityType]?.main }} className="mr-2" />;
          })()}
          <EditableText
            value={category.name}
            onSave={(name) => onUpdateCategory({ name })}
            placeholder="Category name"
            className="font-bold"
            showEditIcon={false}
            style={{ fontSize: `${fontSizes.category}em`, color: colors[entityType]?.main }}
          />
          <span className="ml-2" style={{ fontSize: `${fontSizes.count}em`, color: colors[entityType]?.main, fontWeight: 600 }}>
            ({category.items.length})
          </span>
        </div>
        {/* Pulsante + come icona compatta nell'header */}
        <button
          onClick={e => { e.stopPropagation(); setIsAdding(true); }}
          className="p-1 text-blue-500 hover:text-blue-700 transition-colors ml-2"
          title="Aggiungi nuova voce"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </button>
        {isHovered && !showDeleteConfirm && (
          <button
            onClick={e => {
              e.stopPropagation();
              setShowDeleteConfirm(true);
            }}
            className="p-1 text-red-400 hover:text-red-300 transition-colors opacity-0 group-hover:opacity-100"
            title="Delete category"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      {/* Box di conferma eliminazione categoria */}
      {showDeleteConfirm && (
        <div className="flex flex-col items-center gap-2 mt-2 mb-2 p-2 bg-white border border-red-200 rounded shadow text-center">
          <span className="text-red-700 text-sm mb-1">Sei sicuro di voler eliminare la categoria?</span>
          <div className="flex gap-2">
            <button
              className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 font-semibold text-sm"
              onClick={() => { setShowDeleteConfirm(false); onDeleteCategory(); }}
            >
              Conferma
            </button>
            <button
              className="bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300 font-semibold text-sm"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="mt-2">
          {/* Textbox per nuova voce subito sotto header */}
          {isAdding && (
            <div className="flex items-center space-x-2 mb-2">
              <input
                type="text"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddItem(newItemName);
                  else if (e.key === 'Escape') { setIsAdding(false); setNewItemName(""); }
                }}
                placeholder="Enter item name..."
                className="flex-1 bg-slate-600 text-white px-2 py-1 rounded border border-slate-500 focus:outline-none focus:border-purple-500 text-sm"
                autoFocus
              />
              <button
                onClick={() => handleAddItem(newItemName)}
                className="p-1 text-green-400 hover:text-green-300 transition-colors"
                disabled={!newItemName.trim()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </button>
              <button
                onClick={() => { setIsAdding(false); setNewItemName(""); }}
                className="p-1 text-red-400 hover:text-red-300 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}
          {category.items.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              onUpdate={(updates) => onUpdateItem(item.id, updates)}
              onDelete={() => onDeleteItem(item.id)}
              entityType={entityType}
              textColor="#111"
              bgColor={colors[entityType]?.light}
            />
          ))}
        </div>
      )}
    </div>
  );
};