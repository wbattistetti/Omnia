import React from 'react';
import { useEditorContext } from './EditorContext';
import { iconMap } from './ddtUtils';
import { useFontClasses } from '../../../hooks/useFontClasses';

const ActionCatalog: React.FC = () => {
  const { actionCatalog, showLabel } = useEditorContext();
  const { combinedClass } = useFontClasses();

  if (!actionCatalog || actionCatalog.length === 0) {
    return (
      <div className={combinedClass} style={{ padding: 16, background: '#f9f9f9', borderRadius: 8 }}>
        <h4>📚 Catalogo Azioni</h4>
        <p>Nessuna azione disponibile</p>
      </div>
    );
  }

  return (
    <div className={combinedClass} style={{ padding: 16, background: '#f9f9f9', borderRadius: 8 }}>
      <h4>📚 Catalogo Azioni ({actionCatalog.length})</h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {actionCatalog.map((action: any, index: number) => (
          <div
            key={action.id || index}
            style={{
              padding: 12,
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/json', JSON.stringify({
                action,
                icon: iconMap[action.icon] || null,
                color: action.color || '#6b7280',
                primaryValue: action.primaryValue,
                parameters: action.parameters
              }));
            }}
          >
            {iconMap[action.icon] && (
              <div style={{ color: action.color || '#6b7280' }}>
                {iconMap[action.icon]}
              </div>
            )}
            <div>
              <div style={{ fontWeight: 'bold' }}>
                {typeof action.label === 'object' ? action.label.it || action.label.en || action.id : action.label}
              </div>
              {showLabel && action.description && (
                <div style={{ color: '#6b7280', marginTop: 4 }}>
                  {typeof action.description === 'object' ? action.description.it || action.description.en : action.description}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActionCatalog; 