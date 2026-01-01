import React from 'react';
import { createPortal } from 'react-dom';
import { IntellisenseMenu } from '../../../Intellisense/IntellisenseMenu';

interface NodeRowIntellisenseProps {
  showIntellisense: boolean;
  isEditing: boolean;
  nodeOverlayPosition: { left: number; top: number } | null;
  intellisenseQuery: string;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  handleIntellisenseSelect: (item: any) => void;
  handleIntellisenseClose: () => void;
  allowCreatePicker?: boolean;
  onCreateFactoryTask?: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string) => void; // ✅ RINOMINATO: onCreateAgentAct → onCreateFactoryTask
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
  onCreateFactoryTask, // ✅ RINOMINATO: onCreateAgentAct → onCreateFactoryTask
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
        <>
          <IntellisenseMenu
            isOpen={showIntellisense}
            query={intellisenseQuery}
            position={nodeOverlayPosition ? { x: nodeOverlayPosition.left, y: nodeOverlayPosition.top } : { x: 0, y: 0 }}
            referenceElement={inputRef.current}
            onSelect={handleIntellisenseSelect}
            onClose={() => {
              handleIntellisenseClose();
            }}
            allowCreatePicker={!!allowCreatePicker}
            filterCategoryTypes={['taskTemplates', 'backendActions', 'macrotasks']}
            onCreateFactoryTask={onCreateFactoryTask ? (name: string, scope?: 'global' | 'industry', categoryName?: string) => {
              return onCreateFactoryTask(name, createRowUpdateCallback, scope, categoryName); // ✅ RINOMINATO: onCreateAgentAct → onCreateFactoryTask
            } : undefined}
            onCreateBackendCall={onCreateBackendCall ? (name: string, scope?: 'global' | 'industry', categoryName?: string) => onCreateBackendCall(name, createRowUpdateCallback, scope, categoryName) : undefined}
            onCreateTask={onCreateTask ? (name: string, scope?: 'global' | 'industry', categoryName?: string) => onCreateTask(name, createRowUpdateCallback, scope, categoryName) : undefined}
          />
        </>,
        document.body
      )}
    </>
  );
};