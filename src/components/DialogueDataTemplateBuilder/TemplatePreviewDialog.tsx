/**
 * TemplatePreviewDialog - Componente riutilizzabile per preview e conferma struttura dati
 *
 * Mostra la struttura dati (data tree) e permette all'utente di confermare o rifiutare.
 * Usato sia per template candidati che per strutture generate da AI.
 */

import React from 'react';
import DataCollection, { type SchemaNode } from './DDTWizard/MainDataCollection';

interface TemplatePreviewDialogProps {
  open: boolean;
  title?: string;
  message?: string;
  rootLabel: string;
  dataTree: SchemaNode[];
  onConfirm: () => void | Promise<void>;
  onReject: () => void;
  onDataTreeChange?: (dataTree: SchemaNode[]) => void;
  compact?: boolean;
}

export const TemplatePreviewDialog: React.FC<TemplatePreviewDialogProps> = ({
  open,
  title,
  message = 'I guess you want to retrieve this kind of data:',
  rootLabel,
  dataTree,
  onConfirm,
  onReject,
  onDataTreeChange,
  compact = true
}) => {
  if (!open) {
    return null;
  }

  const [localDataTree, setLocalDataTree] = React.useState<SchemaNode[]>(dataTree);
  const [selectedIdx, setSelectedIdx] = React.useState<number>(0);

  // Sync external dataTree changes
  React.useEffect(() => {
    setLocalDataTree(dataTree);
  }, [dataTree]);

  const handleDataTreeChange = (newDataTree: SchemaNode[]) => {
    setLocalDataTree(newDataTree);
    if (onDataTreeChange) {
      onDataTreeChange(newDataTree);
    }
  };

  const handleConfirm = async () => {
    // Update external dataTree before confirming
    if (onDataTreeChange) {
      onDataTreeChange(localDataTree);
    }
    await onConfirm();
  };

  return (
    <div style={{ padding: 8 }}>
      {/* Header */}
      {title && (
        <div style={{
          color: '#e2e8f0',
          marginBottom: 8,
          fontSize: 16,
          fontWeight: 600
        }}>
          {title}
        </div>
      )}

      <p style={{
        color: '#e2e8f0',
        marginBottom: 8,
        fontSize: 14,
        fontWeight: 500
      }}>
        {message}
      </p>

      {/* Struttura dati compatta */}
      <div style={{
        marginBottom: 12,
        background: 'transparent'
      }}>
        <DataCollection
          rootLabel={rootLabel}
          mains={localDataTree}
          onChangeMains={handleDataTreeChange}
          onAddMain={() => {
            // Add empty main node
            const newMain: SchemaNode = {
              label: 'New Field',
              type: 'text',
              constraints: [],
              subTasks: []
            };
            handleDataTreeChange([...localDataTree, newMain]);
          }}
          progressByPath={{}}
          fieldProcessingStates={{}}
          selectedIdx={selectedIdx}
          onSelect={setSelectedIdx}
          autoEditIndex={null}
          onChangeEvent={() => {}}
          onAutoMap={async () => {}}
          onRetryField={() => {}}
          onCreateManually={() => {}}
          compact={compact}
        />
      </div>

      {/* Bottoni */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8
      }}>
        <button
          onClick={handleConfirm}
          style={{
            background: '#22c55e',
            color: '#0b1220',
            border: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          Yes
        </button>
        <button
          onClick={onReject}
          style={{
            background: '#ef4444',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          No
        </button>
      </div>
    </div>
  );
};

export default TemplatePreviewDialog;
