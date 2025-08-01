import React from 'react';

const Item = ({ item, onDelete, onUpdate, textColor = '#fff' }) => (
  <div style={{ display: 'flex', alignItems: 'center', marginLeft: 16, marginTop: 2 }}>
    <span style={{ flex: 1, color: textColor }}>{item.label}</span>
    <button onClick={() => onDelete(item.id)} style={{ color: '#888', marginLeft: 8 }}>🗑</button>
    {/* Add more actions if needed */}
  </div>
);

export default React.memo(Item);