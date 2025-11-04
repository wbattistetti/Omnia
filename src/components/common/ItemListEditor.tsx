import React, { useState } from 'react';
import ListGrid from '../../features/intent-editor/ui/common/ListGrid';
import type { ListItem } from '../../features/intent-editor/ui/common/ListGrid';
import { Trash2, CheckSquare2, Square } from 'lucide-react';
import { ImportDropdown } from '../../features/intent-editor/ui/common/ImportDropdown';

export interface ItemListEditorProps<T extends ListItem = ListItem> {
  // Data
  items: T[];
  selectedId?: string | null;
  onSelect: (id: string) => void;

  // Editing callbacks
  onAdd: (name: string) => string; // Returns the ID of the added item
  onEdit?: (id: string, newLabel: string, prevLabel: string) => void;
  onDelete?: (id: string) => void;
  onImport?: (values: string[]) => void;
  onClearAll?: () => void;

  // Enable/disable (optional)
  itemEnabled?: (item: T) => boolean;
  onToggleEnabled?: (id: string) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;

  // UI customization
  title?: string;
  placeholder?: string;
  addButtonLabel?: string;
  LeftIcon?: React.ComponentType<{ size?: number; className?: string }>;
  labelAddon?: (item: T) => React.ReactNode;
  labelRenderer?: (item: T) => React.ReactNode;
  headerColor?: string; // CSS class for header background (default: amber-200)
  borderColor?: string; // CSS class for border (default: amber-300)

  // Import messages
  importSuccessMessage?: (count: number) => string;
  importErrorMessage?: {
    clipboard?: string;
    file?: string;
    empty?: string;
  };

  // Clear confirmation
  clearConfirmMessage?: (count: number) => string;

  // Custom header actions (optional)
  headerActions?: React.ReactNode;
}

/**
 * Generic item list editor component with full CRUD functionality
 * Used in Data Extractor (IntentEditorCommon) as SSOT for editing intents
 */
export default function ItemListEditor<T extends ListItem = ListItem>({
  items,
  selectedId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onImport,
  onClearAll,
  itemEnabled,
  onToggleEnabled,
  onSelectAll,
  onDeselectAll,
  title = 'Intents',
  placeholder = 'Add or find a problem…',
  addButtonLabel = '+',
  LeftIcon,
  labelAddon,
  labelRenderer,
  headerColor = 'bg-amber-200',
  borderColor = 'border-amber-300',
  importSuccessMessage = (count) => `Importati ${count} items`,
  importErrorMessage = {
    clipboard: 'Errore durante la lettura del clipboard',
    file: 'Errore durante la lettura del file',
    empty: 'Nessun valore valido trovato'
  },
  clearConfirmMessage = (count) => `Sei sicuro di voler rimuovere tutti gli ${count} items?`,
  headerActions,
}: ItemListEditorProps<T>) {
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Handler per import items
  const handleImportItems = (values: string[]) => {
    if (onImport) {
      onImport(values);
    } else {
      // Default: chiama onAdd per ogni valore
      values.forEach(value => {
        onAdd(value);
      });
    }
  };

  // Clear all items
  const handleClearAll = () => {
    if (items.length === 0 || !onClearAll) return;
    const message = clearConfirmMessage(items.length);
    if (!confirm(message)) {
      return;
    }
    onClearAll();
  };

  return (
    <div className={`border ${borderColor} overflow-hidden shadow-sm flex flex-col h-full min-h-0`}>
      {/* Header con controlli di editing */}
      <div className={`px-3 py-2 ${headerColor} text-slate-900 font-semibold border-b flex items-center justify-between`}>
        <span>{title}</span>
        <div className="flex items-center gap-2">
          {/* Pulsanti Seleziona/Deseleziona tutto (solo se onToggleEnabled è fornito) */}
          {onToggleEnabled && onSelectAll && onDeselectAll && (
            <>
              <button
                onClick={onSelectAll}
                disabled={items.length === 0}
                className="p-1.5 rounded border bg-white hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Seleziona tutto"
              >
                <CheckSquare2 size={16} />
              </button>
              <button
                onClick={onDeselectAll}
                disabled={items.length === 0}
                className="p-1.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Deseleziona tutto"
              >
                <Square size={16} />
              </button>
            </>
          )}

          {/* Custom header actions (es. Phrases dropdown) */}
          {headerActions}

          {/* Import dropdown (solo se onImport o onAdd è fornito E non c'è headerActions) */}
          {(onImport || onAdd) && !headerActions && (
            <ImportDropdown
              onImport={handleImportItems}
              buttonLabel="Import"
              successMessage={importSuccessMessage}
              errorMessage={importErrorMessage}
            />
          )}

          {/* Clear all button (solo se onClearAll è fornito) */}
          {onClearAll && (
            <button
              onClick={handleClearAll}
              disabled={items.length === 0}
              className="p-1.5 rounded border bg-white hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Clear All"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Container per ListGrid con editing completo */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ListGrid
          items={items}
          selectedId={selectedId || undefined}
          onSelect={onSelect}
          placeholder={placeholder}
          addButtonLabel={addButtonLabel}
          highlightedId={highlightedId}
          onEnterAdd={(name) => {
            const id = onAdd(name);
            onSelect(id);
            // Evidenzia l'item appena aggiunto
            setHighlightedId(id);
            // Scrolla l'item nella vista
            setTimeout(() => {
              const element = document.querySelector(`[data-item-id="${id}"]`) as HTMLElement;
              if (element) {
                element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }
            }, 50);
            // Rimuovi l'highlight dopo 2 secondi
            setTimeout(() => {
              setHighlightedId(null);
            }, 2000);
          }}
          LeftIcon={LeftIcon}
          sort="alpha"
          labelAddon={labelAddon}
          rightSlot={() => null}
          itemEnabled={itemEnabled}
          onToggleEnabled={onToggleEnabled}
          onEditItem={onEdit}
          onDeleteItem={onDelete}
        />
      </div>
    </div>
  );
}

