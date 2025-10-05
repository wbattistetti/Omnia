import React from 'react';
import { createPortal } from 'react-dom';
import { IntellisenseMenu } from '../Intellisense/IntellisenseMenu';

interface NodeRowIntellisenseProps {
  showIntellisense: boolean;
  isEditing: boolean;
  nodeOverlayPosition: { left: number; top: number } | null;
  intellisenseQuery: string;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  handleIntellisenseSelect: (item: any) => void;
  handleIntellisenseClose: () => void;
  onCreateAgentAct?: (name: string, onRowUpdate?: (item: any) => void) => void;
  onCreateBackendCall?: (name: string, onRowUpdate?: (item: any) => void) => void;
  onCreateTask?: (name: string, onRowUpdate?: (item: any) => void) => void;
}

export const NodeRowIntellisense: React.FC<NodeRowIntellisenseProps> = ({
  showIntellisense,
  isEditing,
  nodeOverlayPosition,
  intellisenseQuery,
  inputRef,
  handleIntellisenseSelect,
  handleIntellisenseClose,
  onCreateAgentAct,
  onCreateBackendCall,
  onCreateTask
}) => {

  // Crea callback per aggiornare la riga corrente
  const createRowUpdateCallback = (item: any) => {
    handleIntellisenseSelect(item);
  };

  return (
    <>
      {showIntellisense && isEditing && nodeOverlayPosition && createPortal(
        <div
          className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-xl p-3"
          style={{
            left: nodeOverlayPosition.left,
            top: nodeOverlayPosition.top + 4,
            minWidth: '280px'
          }}
        >
          {/* Header */}
          <div className="text-sm font-medium text-gray-700 mb-2">
            Seleziona azione o atto per il nodo
          </div>
          {/* Help text */}
          <div className="text-xs text-gray-500 mb-2">
            Inizia a digitare per vedere le azioni disponibili
          </div>
          <IntellisenseMenu
            isOpen={showIntellisense}
            query={intellisenseQuery}
            position={{ x: 0, y: 0 }}
            referenceElement={inputRef.current}
            onSelect={handleIntellisenseSelect}
            onClose={handleIntellisenseClose}
            filterCategoryTypes={['agentActs', 'backendActions', 'tasks']}
            onCreateAgentAct={onCreateAgentAct ? (name: string) => {
              return onCreateAgentAct(name, createRowUpdateCallback);
            } : undefined}
            onCreateBackendCall={onCreateBackendCall ? (name: string) => onCreateBackendCall(name, createRowUpdateCallback) : undefined}
            onCreateTask={onCreateTask ? (name: string) => onCreateTask(name, createRowUpdateCallback) : undefined}
          />
        </div>,
        document.body
      )}
    </>
  );
};