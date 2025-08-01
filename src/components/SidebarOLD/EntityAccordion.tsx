import React from 'react';
import { Plus, ChevronDown, Trash2 } from 'lucide-react';

/**
 * EntityAccordion: accordion per entità (Agent Acts, ecc.), header con icona, titolo, chevron, +, lista categorie, editing inline, add, delete, conferma cancellazione.
 * TODO: animare apertura/chiusura, focus, aria-label, icone coerenti.
 */
const EntityAccordion: React.FC<{
  title: string;
  icon: React.ReactNode;
  color: string;
  isOpen: boolean;
  onToggle: () => void;
  categories: any[];
  onAddCategory: () => void;
  onEditCategory: (id: string, label: string) => void;
  onDeleteCategory: (id: string) => void;
  onAddItem: (categoryId: string, label: string) => void;
  onEditItem: (categoryId: string, itemId: string, label: string) => void;
  onDeleteItem: (categoryId: string, itemId: string) => void;
}> = ({ title, icon, color, isOpen, onToggle, categories, onAddCategory, onEditCategory, onDeleteCategory, onAddItem, onEditItem, onDeleteItem }) => {
  return (
    <div style={{ marginBottom: 12, background: isOpen ? '#fff7ed' : '#fff', borderRadius: 8, boxShadow: isOpen ? '0 2px 8px #fed7aa55' : 'none' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', cursor: 'pointer', userSelect: 'none' }}
        onClick={onToggle}
        tabIndex={0}
        aria-expanded={isOpen}
      >
        <span style={{ marginRight: 12 }}>{icon}</span>
        <span style={{ fontWeight: 700, color, flex: 1 }}>{title}</span>
        <span style={{ transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <ChevronDown className="w-5 h-5 text-gray-400" />
        </span>
        <button title="Aggiungi categoria" onClick={e => { e.stopPropagation(); onAddCategory(); }} style={{ color, background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8 }}>
          <Plus className="w-5 h-5" />
        </button>
      </div>
      {isOpen && (
        <div style={{ padding: '8px 0 0 0' }}>
          {categories.map((cat: any) => (
            <div key={cat.id} style={{ marginBottom: 8, background: '#fff', borderRadius: 6, boxShadow: '0 1px 4px #0001', padding: 8 }}>
              {/* TODO: header categoria, label, matita, cestino, spunta/X, editing inline */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color, flex: 1 }}>{cat.label}</span>
                {/* TODO: matita, spunta/X, cestino, editing inline */}
                <button title="Elimina categoria" onClick={() => onDeleteCategory(cat.id)} style={{ background: 'none', border: 'none', marginLeft: 8, cursor: 'pointer' }}>
                  <Trash2 className="w-5 h-5 text-orange-700 hover:text-red-600" />
                </button>
                {/* TODO: conferma cancellazione inline */}
                <button title="Aggiungi voce" onClick={() => onAddItem(cat.id, '')} style={{ color, background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8 }}>
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              {/* TODO: lista voci/items, editing inline, matita, spunta/X, cestino, conferma cancellazione */}
              <div style={{ marginTop: 6 }}>
                {cat.items && cat.items.map((item: any) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {/* TODO: matita, spunta/X, cestino, editing inline */}
                    <button title="Elimina voce" onClick={() => onDeleteItem(cat.id, item.id)} style={{ background: 'none', border: 'none', marginLeft: 8, cursor: 'pointer' }}>
                      <Trash2 className="w-5 h-5 text-orange-700 hover:text-red-600" />
                    </button>
                    {/* TODO: conferma cancellazione inline */}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EntityAccordion;