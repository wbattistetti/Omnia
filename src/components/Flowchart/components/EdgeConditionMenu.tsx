import React from 'react';

export interface EdgeConditionMenuProps {
  isOpen: boolean;
  position: { x: number, y: number };
  onSelectCondition: (condition: string) => void;
  onSelectElse: () => void;
  onClose: () => void;
  seedItems: any[];
  extraItems: any[];
  sourceNodeId?: string;
  sourceRows?: any[];
  onCreateCondition?: (label: string) => void;
}

export const EdgeConditionMenu: React.FC<EdgeConditionMenuProps> = ({
  isOpen,
  position,
  onSelectCondition,
  onSelectElse,
  onClose,
  seedItems,
  extraItems,
  sourceNodeId,
  sourceRows,
  onCreateCondition
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="absolute z-50 bg-white border border-slate-200 rounded shadow-lg p-2 min-w-[220px] max-h-[400px] overflow-y-auto"
      style={{ left: position.x, top: position.y }}
    >
      <div className="flex justify-between items-center mb-2 border-b pb-1">
        <h3 className="text-sm font-medium">Condizione connessione</h3>
        <button 
          className="text-xs text-slate-500 hover:text-slate-700"
          onClick={onClose}
        >✕</button>
      </div>
      
      <div className="space-y-1">
        {seedItems && seedItems.length > 0 && (
          <div className="mb-2">
            <h4 className="text-xs font-medium text-slate-500 mb-1">Condizioni suggerite</h4>
            <div className="space-y-1">
              {seedItems.map((item, i) => (
                <button
                  key={`seed_${i}`}
                  className="block w-full text-left px-2 py-1 text-sm rounded hover:bg-slate-100"
                  onClick={() => onSelectCondition(item.label || item)}
                >
                  {item.label || item}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <button
          className="block w-full text-left px-2 py-1 text-sm rounded bg-purple-50 hover:bg-purple-100"
          onClick={onSelectElse}
        >
          Else (default)
        </button>
        
        {onCreateCondition && (
          <button
            className="block w-full text-left px-2 py-1 text-sm rounded bg-blue-50 hover:bg-blue-100 mt-2"
            onClick={() => {
              const condition = prompt('Inserisci condizione personalizzata:');
              if (condition) onCreateCondition(condition);
            }}
          >
            Crea condizione...
          </button>
        )}
      </div>
    </div>
  );
};
