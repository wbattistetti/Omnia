import React, { useState } from 'react';
import type { SchemaNode } from './dataCollection';
import ProgressBar from './components/ProgressBar';
import MainHeader from './components/MainHeader';
import ConstraintsList from './components/ConstraintsList';
import SubDataList from './components/SubDataList';
import { useFieldProcessing } from './hooks/useFieldProcessing';
import { useMainEditing } from './hooks/useMainEditing';
import { useSubEditing } from './hooks/useSubEditing';
import { useConstraints } from './hooks/useConstraints';
import type { FieldProcessingState } from './hooks/useFieldProcessing';

interface dataWizardProps {
  node: SchemaNode;
  onChange: (node: SchemaNode) => void;
  onRemove: () => void;
  // onAddSub removed (plus now lives near the pencil)
  selected?: boolean;
  autoEdit?: boolean;
  pathPrefix?: string;
  onChangeEvent?: (e: { type: string; path: string; payload?: any }) => void;
  onRequestOpen?: () => void;
  onRetryField?: (fieldId: string) => void;
  onCreateManually?: () => void;
  compact?: boolean; // ✅ Modalità compatta per conferma
}


const DataWizard: React.FC<dataWizardProps & {
  progressByPath?: Record<string, number>;
  fieldProcessingStates?: Record<string, FieldProcessingState>;
}> = ({ node, onChange, onRemove, progressByPath, fieldProcessingStates, selected, autoEdit, pathPrefix = '', onChangeEvent, onRequestOpen, onRetryField, onCreateManually, compact = false }) => {
  // Ensure open on demand (e.g., pencil click) in addition to selection
  const [forceOpen, setForceOpen] = useState(false);
  const [hoverHeader, setHoverHeader] = useState(false);
  const [hoverSubIdx, setHoverSubIdx] = useState<number | null>(null);

  // Processing state helpers (extracted to hook)
  const { getFieldProcessingState, getStatusIcon, getStatusMessage } = useFieldProcessing({
    fieldProcessingStates,
    progressByPath
  });

  // Main editing (extracted to hook)
  const {
    isEditingMain,
    labelDraft,
    setLabelDraft,
    fieldErrors,
    retryLoading,
    commitLoading,
    commitMain,
    cancelMain,
    retryField,
    startEditing: startEditingMain
  } = useMainEditing({
    node,
    autoEdit,
    onChange,
    onChangeEvent
  });

  // Sub editing (extracted to hook)
  const {
    editingSubIdx,
    subDraft,
    setSubDraft,
    startEditSub,
    commitSub,
    cancelSub,
    handleQuickAddSub
  } = useSubEditing({
    node,
    pathPrefix,
    onChange,
    onChangeEvent
  });

  // Constraints management (extracted to hook)
  const {
    hoverMainConstraints,
    setHoverMainConstraints,
    editingConstraint,
    constraintPayoffDraft,
    setConstraintPayoffDraft,
    addMainConstraint,
    addSubConstraint,
    startEditConstraint,
    commitConstraint,
    cancelConstraint,
    deleteConstraint,
  } = useConstraints({
    node,
    pathPrefix,
    onChange,
    onChangeEvent
  });

  // open ora dipende da selected
  const open = !!selected || forceOpen;

  React.useEffect(() => {
    if (!selected) setForceOpen(false);
  }, [selected]);

  return (
    <div
      style={{
        border: compact ? 'none' : (selected ? '4px solid #fff' : '1px solid #7c2d12'),
        borderRadius: compact ? 0 : 10,
        marginBottom: compact ? 4 : 10,
        background: compact ? 'transparent' : '#0b1220',
        boxSizing: 'border-box',
        transition: 'border 0.15s',
        minWidth: compact ? 'auto' : 280,
      }}
    >
      <MainHeader
        node={node}
        isEditingMain={isEditingMain}
        labelDraft={labelDraft}
        setLabelDraft={setLabelDraft}
        fieldErrors={fieldErrors}
        retryLoading={retryLoading}
        commitLoading={commitLoading}
        commitMain={commitMain}
        cancelMain={cancelMain}
        retryField={retryField}
        startEditingMain={startEditingMain}
        handleQuickAddSub={handleQuickAddSub}
        addMainConstraint={addMainConstraint}
        onRemove={onRemove}
        hoverHeader={hoverHeader}
        setHoverHeader={setHoverHeader}
        setForceOpen={setForceOpen}
        onRequestOpen={onRequestOpen}
        open={open}
        progressByPath={progressByPath}
        getFieldProcessingState={getFieldProcessingState}
        getStatusIcon={getStatusIcon}
        getStatusMessage={getStatusMessage}
        onRetryField={onRetryField}
        onCreateManually={onCreateManually}
      />
      {/* 📐 Riga 2: Barra di progresso sotto, full width */}
      {(() => {
        const path = node.label;
        const val = progressByPath ? progressByPath[path] : undefined;
        if (typeof val === 'number') {
          return <ProgressBar progress={val} />;
        }
        return null;
      })()}
      {open && (
        <div style={{ padding: compact ? 4 : 12, paddingTop: 0 }}>
          {/* Constraints for main node */}
          {node.constraints && (
            <div
              onMouseEnter={() => setHoverMainConstraints(true)}
              onMouseLeave={() => setHoverMainConstraints(false)}
              style={{ marginBottom: compact ? 4 : 8 }}
            >
              <ConstraintsList
                constraints={Array.isArray(node.constraints) ? node.constraints : []}
                scope="main"
                editingConstraint={editingConstraint}
                constraintPayoffDraft={constraintPayoffDraft}
                setConstraintPayoffDraft={setConstraintPayoffDraft}
                startEditConstraint={startEditConstraint}
                commitConstraint={commitConstraint}
                cancelConstraint={cancelConstraint}
                deleteConstraint={deleteConstraint}
                hoverMainConstraints={hoverMainConstraints}
              />
            </div>
          )}

          {/* Sub-data list */}
          <SubDataList
            node={node}
            editingSubIdx={editingSubIdx}
            subDraft={subDraft}
            setSubDraft={setSubDraft}
            startEditSub={startEditSub}
            commitSub={commitSub}
            cancelSub={cancelSub}
            onChange={onChange}
            hoverSubIdx={hoverSubIdx}
            setHoverSubIdx={setHoverSubIdx}
            addSubConstraint={addSubConstraint}
            editingConstraint={editingConstraint}
            constraintPayoffDraft={constraintPayoffDraft}
            setConstraintPayoffDraft={setConstraintPayoffDraft}
            startEditConstraint={startEditConstraint}
            commitConstraint={commitConstraint}
            cancelConstraint={cancelConstraint}
            deleteConstraint={deleteConstraint}
            progressByPath={progressByPath}
            getFieldProcessingState={getFieldProcessingState}
            getStatusIcon={getStatusIcon}
            getStatusMessage={getStatusMessage}
            onRetryField={onRetryField}
            onCreateManually={onCreateManually}
            compact={compact}
          />
        </div>
      )}
    </div>
  );
};

export default DataWizard;
