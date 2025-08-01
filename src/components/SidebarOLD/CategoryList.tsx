import React from 'react';

interface Category {
  id: string;
  name: string;
  items?: { id: string; label: string }[];
}

interface CategoryListProps {
  categories: Category[];
  color: string;
  lightColor: string;
  textColor: string;
  onAddItem: (categoryId: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  onDeleteItem: (categoryId: string, itemId: string) => void;
  addingItemFor: string | null;
  newItemLabel: string;
  setNewItemLabel: (v: string) => void;
  onConfirmAddItem: (categoryId: string) => void;
  onCancelAddItem: () => void;
}

const CategoryList: React.FC<CategoryListProps> = ({
  categories,
  color,
  lightColor,
  textColor,
  onAddItem,
  onDeleteCategory,
  onDeleteItem,
  addingItemFor,
  newItemLabel,
  setNewItemLabel,
  onConfirmAddItem,
  onCancelAddItem,
}) => (
  <div>
    {categories.map(cat => (
      <div key={cat.id} style={{ borderRadius: 6, margin: '8px 0', padding: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ color: textColor, fontWeight: 600, flex: 1 }}>{cat.name}</span>
          <button onClick={() => onAddItem(cat.id)} style={{ color, marginLeft: 8 }}>+</button>
          <button onClick={() => onDeleteCategory(cat.id)} style={{ color: '#888', marginLeft: 8 }}>🗑</button>
        </div>
        {/* Add item input */}
        {addingItemFor === cat.id && (
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
            <input
              value={newItemLabel}
              onChange={e => setNewItemLabel(e.target.value)}
              placeholder="Nuovo item..."
              style={{ flex: 1, marginRight: 4 }}
            />
            <button onClick={() => onConfirmAddItem(cat.id)} style={{ color: 'green' }}>✔</button>
            <button onClick={onCancelAddItem} style={{ color: 'red' }}>✖</button>
          </div>
        )}
        {/* Items */}
        {cat.items && cat.items.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', marginLeft: 16, marginTop: 2 }}>
            <span style={{ flex: 1, color: textColor }}>{item.label}</span>
            <button onClick={() => onDeleteItem(cat.id, item.id)} style={{ color: '#888', marginLeft: 8 }}>🗑</button>
          </div>
        ))}
      </div>
    ))}
  </div>
);

export default CategoryList;