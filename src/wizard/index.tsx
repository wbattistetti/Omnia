// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Card-Based Wizard
 *
 * Main wizard component that orchestrates all phases:
 * - Phase A: Structure Proposal
 * - Phase B: Iteration Feedback
 * - Phase C: Mode Selection
 * - Phase D: Pipeline Execution
 *
 * This replaces/integrates with the existing DDTWizard.
 */

import React, { useMemo, useCallback } from 'react';
import { useWizardState } from './hooks/useWizardState';
import { WizardContextProvider } from './context/WizardContext';
import { useModePropagation } from './hooks/useModePropagation';
import type { SchemaNode } from './types/wizard.types';
import type { NodePipelineProgress, NodeGenerationResult } from './types/pipeline.types';
import PhaseA_StructureProposal from './phases/PhaseA_StructureProposal';
import PhaseB_IterationFeedback from './phases/PhaseB_IterationFeedback';
import PhaseC_ModeSelection from './phases/PhaseC_ModeSelection';
import PhaseD_Pipeline from './phases/PhaseD_Pipeline';

interface CardBasedWizardProps {
  taskLabel: string;
  rootLabel?: string;
  onComplete?: (structure: SchemaNode[], artifacts: Map<string, NodeGenerationResult>) => void;
  onCancel?: () => void;
}

export default function CardBasedWizard({
  taskLabel,
  rootLabel = 'Data',
  onComplete,
  onCancel
}: CardBasedWizardProps) {
  const {
    state,
    changePhase,
    updateStructureData,
    changeRootLabel,
    markTemplateFound,
    markTemplateNotFound,
    setFeedback,
    updateNodeProgress,
    setNodeResult
  } = useWizardState(rootLabel);

  const handleStructureApproved = (structure: SchemaNode[]) => {
    updateStructureData(structure);
    changePhase('mode-selection');
  };

  const handleStructureRejected = () => {
    changePhase('iteration');
  };

  const handleStructureRegenerated = (structure: SchemaNode[]) => {
    updateStructureData(structure);
    changePhase('structure-proposal'); // Go back to approval
  };

  const handleManualEdit = () => {
    // TODO: Open manual editor (existing MainDataWizard)
    console.log('[CardBasedWizard] Manual edit requested');
  };

  const handleAbandon = () => {
    onCancel?.();
  };

  const handleStartGeneration = () => {
    changePhase('pipeline');
  };

  const handlePipelineComplete = () => {
    changePhase('complete');
    onComplete?.(state.structure, state.generatedArtifacts);
  };

  const handlePipelineError = (error: string) => {
    console.error('[CardBasedWizard] Pipeline error:', error);
    // TODO: Show error UI
  };

  // Context actions for shared state
  const { setNodeMode } = useModePropagation(state.structure, updateStructureData);

  const contextValue = useMemo(() => ({
    structure: state.structure,
    updateNode: (nodeId: string, node: SchemaNode) => {
      const updated = state.structure.map(n => n.id === nodeId ? node : n);
      updateStructureData(updated);
    },
    addSubNode: (parentNodeId: string) => {
      // Handled by useNodeCardLogic
    },
    deleteNode: (nodeId: string) => {
      const updated = state.structure.filter(n => n.id !== nodeId);
      updateStructureData(updated);
    },
    setNodeMode: (nodeId: string, mode: 'ai' | 'manual' | 'postponed', propagate?: boolean) => {
      setNodeMode(nodeId, mode, propagate ?? true);
    },
    progressMap: state.pipelineProgress,
    results: state.generatedArtifacts,
    updateProgress: (nodeId: string, progress: NodePipelineProgress) => {
      updateNodeProgress(nodeId, progress);
    },
    setResult: (nodeId: string, result: NodeGenerationResult) => {
      setNodeResult(nodeId, result);
    },
    onCompleteAuto: (nodeId: string) => {
      setNodeMode(nodeId, 'ai', true);
    },
    onEditManual: (nodeId: string) => {
      setNodeMode(nodeId, 'manual', false);
    },
    onMarkForLater: (nodeId: string) => {
      setNodeMode(nodeId, 'postponed', false);
    },
    onChipClick: (nodeId: string, step: string) => {
      // TODO: Handle chip click
    }
  }), [state, updateStructureData, setNodeMode, updateNodeProgress, setNodeResult]);

  // Render phase based on current state
  const renderPhase = () => {
    switch (state.phase) {
      case 'template-search':
      case 'structure-proposal':
        return (
          <PhaseA_StructureProposal
            taskLabel={taskLabel}
            rootLabel={state.rootLabel}
            structure={state.structure}
            onStructureApproved={handleStructureApproved}
            onStructureRejected={handleStructureRejected}
            onStructureChange={updateStructureData}
          />
        );

      case 'iteration':
        return (
          <PhaseB_IterationFeedback
            taskLabel={taskLabel}
            rootLabel={state.rootLabel}
            previousStructure={state.structure}
            onStructureRegenerated={handleStructureRegenerated}
            onManualEdit={handleManualEdit}
            onAbandon={handleAbandon}
            onStructureChange={updateStructureData}
          />
        );

      case 'mode-selection':
        return (
          <PhaseC_ModeSelection
            rootLabel={state.rootLabel}
            structure={state.structure}
            onStructureChange={updateStructureData}
            onStartGeneration={handleStartGeneration}
          />
        );

      case 'pipeline':
        return (
          <PhaseD_Pipeline
            rootLabel={state.rootLabel}
            structure={state.structure}
            onProgressUpdate={updateNodeProgress}
            onNodeResult={setNodeResult}
            onComplete={handlePipelineComplete}
            onError={handlePipelineError}
          />
        );

      case 'complete':
        return (
          <div className="p-8 text-center space-y-4">
            <div className="text-green-400 text-4xl">✓</div>
            <h2 className="text-2xl font-bold text-white">Generation Complete!</h2>
            <p className="text-gray-300">
              All nodes have been processed. You can now review and edit the results.
            </p>
            <button
              onClick={() => onComplete?.(state.structure, state.generatedArtifacts)}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold"
            >
              Open Response Editor
            </button>
          </div>
        );

      default:
        return (
          <div className="p-4 text-center text-gray-400">
            Unknown phase: {state.phase}
          </div>
        );
    }
  };

  return (
    <WizardContextProvider value={contextValue}>
      <div className="w-full h-full bg-gray-950 text-white p-6 overflow-auto">
        {/* Header */}
        <div className="mb-6 pb-4 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-purple-300">Card-Based Wizard</h1>
          <p className="text-gray-400 text-sm mt-1">Task: {taskLabel}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-500">Phase:</span>
            <span className="text-xs px-2 py-1 bg-purple-900/50 rounded text-purple-300">
              {state.phase}
            </span>
          </div>
        </div>

        {/* Phase Content */}
        <div className="min-h-[400px]">
          {renderPhase()}
        </div>

        {/* Footer Actions */}
        {state.phase !== 'complete' && state.phase !== 'pipeline' && (
          <div className="mt-6 pt-4 border-t border-gray-700 flex items-center justify-end gap-4">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </WizardContextProvider>
  );
}
