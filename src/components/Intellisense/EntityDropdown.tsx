import React, { useState } from 'react';
import { ENTITY_TYPE_CONFIGS, EntityTypeConfig } from './EntityConfigs';
import { Plus, Bot } from 'lucide-react';

interface EntityDropdownProps {
  entityTypes: string[];
  onEntitySelect: (entityType: string, scope: 'global' | 'industry') => void;
  scope: 'global' | 'industry';
  query: string;
  showCategorySelector?: boolean;
  onCategorySelectorShow?: (scope: 'global' | 'industry') => void;
  // Props per le categorie
  existingCategories?: string[];
  onCategorySelect?: (categoryName: string, scope: 'global' | 'industry') => void;
  showCategoryInput?: boolean;
  newCategoryName?: string;
  onNewCategoryNameChange?: (name: string) => void;
  onCreateNewCategory?: (scope: 'global' | 'industry') => void;
  onCategoryInputKeyDown?: (e: React.KeyboardEvent, scope: 'global' | 'industry') => void;
}

export const EntityDropdown: React.FC<EntityDropdownProps> = ({
  entityTypes,
  onEntitySelect,
  scope,
  query,
  showCategorySelector = false,
  onCategorySelectorShow,
  // Props per le categorie
  existingCategories = [],
  onCategorySelect,
  showCategoryInput = false,
  newCategoryName = '',
  onNewCategoryNameChange,
  onCreateNewCategory,
  onCategoryInputKeyDown
}) => {
  const [hoveredEntity, setHoveredEntity] = useState<string | null>(null);
  const [localShowCategoryInput, setLocalShowCategoryInput] = useState(false);

  const handleEntityClick = (entityType: string) => {
    if (entityType === 'agentAct' && onCategorySelectorShow) {
      // Per Agent Acts, mostra il selettore categoria
      onCategorySelectorShow(scope);
    } else {
      // Per altri tipi, crea direttamente
      onEntitySelect(entityType, scope);
    }
  };

  return (
    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 min-w-[160px]">
      {entityTypes.map((entityType) => {
        const config = ENTITY_TYPE_CONFIGS[entityType];
        if (!config) return null;

        return (
          <div
            key={entityType}
            className="relative"
            onMouseEnter={() => setHoveredEntity(entityType)}
            onMouseLeave={() => setHoveredEntity(null)}
          >
            <button
              onClick={() => {
                console.log(`🎯 Create ${scope} ${config.label} clicked with query:`, query.trim());
                handleEntityClick(entityType);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-100 transition-colors"
            >
              <span className={config.color}>
                {config.icon}
              </span>
              {config.label}
              {entityType === 'agentAct' && (
                <span className="ml-auto text-gray-400 text-xs">▶</span>
              )}
            </button>
            
            {/* Submenu per categorie (solo per Agent Act) - Mostra direttamente le categorie */}
            {entityType === 'agentAct' && hoveredEntity === entityType && (
              <div className="absolute left-full top-0 ml-1 bg-white border border-gray-300 rounded-md shadow-lg z-60 min-w-[400px]">
                {/* Categorize Later */}
                <button
                  onClick={() => onCategorySelect?.('Categorize Later', scope)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-100 transition-colors border-b border-gray-100"
                >
                  <Bot className="w-3 h-3 text-gray-500" />
                  Categorize Later
                </button>
                
                {/* Create New Category */}
                {localShowCategoryInput ? (
                  <div className="flex gap-1 p-2 border-b border-gray-100">
                    <input
                      type="text"
                      placeholder="Create New Category"
                      value={newCategoryName}
                      onChange={(e) => onNewCategoryNameChange?.(e.target.value)}
                      onKeyDown={(e) => onCategoryInputKeyDown?.(e, scope)}
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                      autoFocus
                    />
                    <button
                      onClick={() => onCreateNewCategory?.(scope)}
                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => {
                        onNewCategoryNameChange?.('');
                        setLocalShowCategoryInput(false);
                      }}
                      className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      onNewCategoryNameChange?.('');
                      setLocalShowCategoryInput(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-100 transition-colors border-b border-gray-100 text-gray-500"
                  >
                    <Plus className="w-3 h-3" />
                    Create New Category...
                  </button>
                )}
                
                {/* Separatore */}
                <div className="border-t border-gray-200 my-1"></div>
                
                {/* Categorie esistenti con scrollbar - ordinate alfabeticamente */}
                <div className="max-h-40 overflow-y-auto">
                  {existingCategories
                    .sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }))
                    .map((categoryName) => (
                    <button
                      key={categoryName}
                      onClick={() => onCategorySelect?.(categoryName, scope)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-100 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <Bot className="w-3 h-3 text-green-500" />
                      {categoryName}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
