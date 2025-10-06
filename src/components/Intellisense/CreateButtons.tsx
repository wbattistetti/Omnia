import React, { useState, useEffect } from 'react';
import { CreateButton } from './CreateButton';
import { EntityDropdown } from './EntityDropdown';
import { CONTEXT_CONFIGS, ContextType } from './EntityConfigs';
import { Plus, Bot } from 'lucide-react';

interface CreateButtonsProps {
  context: ContextType;
  query: string;
  projectIndustry?: string;
  isCreating: boolean;
  creatingScope: 'global' | 'industry' | null;
  onEntitySelect: (entityType: string, scope: 'global' | 'industry') => void;
  showCategorySelector?: boolean;
  onCategorySelectorShow?: (scope: 'global' | 'industry') => void;
  onCreateNew?: (name: string, scope?: 'global' | 'industry') => void;
  // Props per il selettore categoria
  existingCategories?: string[];
  onCategorySelect?: (categoryName: string, scope: 'global' | 'industry') => void;
  showCategoryInput?: boolean;
  newCategoryName?: string;
  onNewCategoryNameChange?: (name: string) => void;
  onCreateNewCategory?: (scope: 'global' | 'industry') => void;
  onCategoryInputKeyDown?: (e: React.KeyboardEvent, scope: 'global' | 'industry') => void;
}

export const CreateButtons: React.FC<CreateButtonsProps> = ({
  context,
  query,
  projectIndustry,
  isCreating,
  creatingScope,
  onEntitySelect,
  showCategorySelector = false,
  onCategorySelectorShow,
  onCreateNew,
  // Props per il selettore categoria
  existingCategories = [],
  onCategorySelect,
  showCategoryInput = false,
  newCategoryName = '',
  onNewCategoryNameChange,
  onCreateNewCategory,
  onCategoryInputKeyDown
}) => {
  const entityTypes = CONTEXT_CONFIGS[context];
  const [localShowCategoryInput, setLocalShowCategoryInput] = useState(false);

  // Reset dello stato locale quando il selettore categoria viene chiuso
  useEffect(() => {
    if (!showCategorySelector) {
      setLocalShowCategoryInput(false);
    }
  }, [showCategorySelector]);

  // Se il selettore categoria è attivo, mostra quello invece dei pulsanti
  if (showCategorySelector) {
    const scope = showCategorySelector;
    
    return (
      <div className="space-y-1">
        {/* Categorize Later */}
        <button
          onClick={() => onCategorySelect?.('Categorize Later', scope)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-100 transition-colors bg-white border border-gray-300 rounded-md"
        >
          <Bot className="w-3 h-3 text-gray-500" />
          Categorize Later
        </button>
        
        {/* Create New Category */}
        {localShowCategoryInput ? (
          <div className="flex gap-1">
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
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-100 transition-colors bg-white border border-gray-300 rounded-md text-gray-500"
          >
            <Plus className="w-3 h-3" />
            Create New Category...
          </button>
        )}
        
        {/* Separatore */}
        <div className="border-t border-gray-200 my-2"></div>
        
        {/* Categorie esistenti con scrollbar - ordinate alfabeticamente */}
        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md bg-white">
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
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        {/* Global Button */}
        <CreateButton
          scope="global"
          label="Global"
          isCreating={isCreating}
          creatingScope={creatingScope}
          onClick={() => {}}
          title={`Crea elemento globale (cross-industry)`}
        >
          <EntityDropdown
            entityTypes={entityTypes}
            onEntitySelect={onEntitySelect}
            scope="global"
            query={query}
            showCategorySelector={showCategorySelector}
            onCategorySelectorShow={onCategorySelectorShow}
            // Props per le categorie
            existingCategories={existingCategories}
            onCategorySelect={onCategorySelect}
            showCategoryInput={showCategoryInput}
            newCategoryName={newCategoryName}
            onNewCategoryNameChange={onNewCategoryNameChange}
            onCreateNewCategory={onCreateNewCategory}
            onCategoryInputKeyDown={onCategoryInputKeyDown}
          />
        </CreateButton>

        {/* Industry Button */}
        <CreateButton
          scope="industry"
          label="Industry"
          projectIndustry={projectIndustry}
          isCreating={isCreating}
          creatingScope={creatingScope}
          onClick={() => {}}
          title={`Crea elemento per ${projectIndustry}`}
        >
          {context === 'conditions' && onCreateNew ? (
            // Per condizioni, usa il metodo diretto
            <button
              onClick={() => {
                console.log(`🎯 Create ${projectIndustry} Condition clicked with query:`, query.trim());
                onCreateNew(query.trim(), 'industry');
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-100 transition-colors"
            >
              <span className="text-green-500">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
              Condition
            </button>
          ) : (
            <EntityDropdown
              entityTypes={entityTypes}
              onEntitySelect={onEntitySelect}
              scope="industry"
              query={query}
              showCategorySelector={showCategorySelector}
              onCategorySelectorShow={onCategorySelectorShow}
              // Props per le categorie
              existingCategories={existingCategories}
              onCategorySelect={onCategorySelect}
              showCategoryInput={showCategoryInput}
              newCategoryName={newCategoryName}
              onNewCategoryNameChange={onNewCategoryNameChange}
              onCreateNewCategory={onCreateNewCategory}
              onCategoryInputKeyDown={onCategoryInputKeyDown}
            />
          )}
        </CreateButton>
      </div>
    </div>
  );
};
