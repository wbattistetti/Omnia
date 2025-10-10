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
  allowCreatePicker?: boolean;
  onCreateAgentAct?: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
  onCreateBackendCall?: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
  onCreateTask?: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void;
}

export const NodeRowIntellisense: React.FC<NodeRowIntellisenseProps> = ({
  showIntellisense,
  isEditing,
  nodeOverlayPosition,
  intellisenseQuery,
  inputRef,
  handleIntellisenseSelect,
  handleIntellisenseClose,
  allowCreatePicker,
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
        <IntellisenseMenu
          isOpen={showIntellisense}
          query={intellisenseQuery}
          position={{ x: 0, y: 0 }}
          referenceElement={inputRef.current}
          onSelect={handleIntellisenseSelect}
          onClose={handleIntellisenseClose}
          allowCreatePicker={!!allowCreatePicker}
          filterCategoryTypes={['agentActs', 'backendActions', 'tasks']}
          onCreateAgentAct={onCreateAgentAct ? (name: string, scope?: 'global' | 'industry', categoryName?: string) => {
            return onCreateAgentAct(name, createRowUpdateCallback, scope, categoryName);
          } : undefined}
          onCreateBackendCall={onCreateBackendCall ? (name: string, scope?: 'global' | 'industry', categoryName?: string) => onCreateBackendCall(name, createRowUpdateCallback, scope, categoryName) : undefined}
          onCreateTask={onCreateTask ? (name: string, scope?: 'global' | 'industry', categoryName?: string) => onCreateTask(name, createRowUpdateCallback, scope, categoryName) : undefined}
        />,
        document.body
      )}
    </>
  );
};