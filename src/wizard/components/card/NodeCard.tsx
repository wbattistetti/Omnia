// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Node Card Component (Recursive)
 *
 * Main card component for displaying a node in the tree.
 * Recursively renders sub-nodes as nested cards.
 * Handles editing, expansion, and all node interactions.
 */

import React, { useState, memo } from 'react';
import type { SchemaNode } from '../../types/wizard.types';
import type { NodePipelineProgress } from '../../types/pipeline.types';
import { useNodeCardLogic } from '../../hooks/useNodeCardLogic';
import { useWizardContext } from '../../context/WizardContext';
import NodeCardHeader from './NodeCardHeader';
import NodeCardProgress from './NodeCardProgress';
import NodeCardContent from './NodeCardContent';

interface NodeCardProps {
  node: SchemaNode;
  nodeId: string;
  depth?: number;
  isRoot?: boolean;
  progress?: NodePipelineProgress;
  // Reduced props - use context for shared state
  onNodeChange?: (nodeId: string, node: SchemaNode) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
  showProgress?: boolean;
  compact?: boolean;
}

function NodeCard({
  node,
  nodeId,
  depth = 0,
  isRoot = false,
  progress,
  onNodeChange,
  expanded: controlledExpanded,
  onToggleExpand,
  showProgress = true,
  compact = false
}: NodeCardProps) {
  // Use context for shared actions (graceful degradation if not available)
  let contextActions: {
    addSubNode?: (parentNodeId: string) => void;
    deleteNode?: (nodeId: string) => void;
    onCompleteAuto?: (nodeId: string) => void;
    onEditManual?: (nodeId: string) => void;
    onMarkForLater?: (nodeId: string) => void;
    onChipClick?: (nodeId: string, step: string) => void;
  } = {};

  try {
    const context = useWizardContext();
    contextActions = {
      addSubNode: context.addSubNode,
      deleteNode: context.deleteNode,
      onCompleteAuto: context.onCompleteAuto,
      onEditManual: context.onEditManual,
      onMarkForLater: context.onMarkForLater,
      onChipClick: context.onChipClick
    };
  } catch {
    // Context not available - graceful degradation
  }
  const [internalExpanded, setInternalExpanded] = useState(true);
  const expanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const toggleExpand = onToggleExpand || (() => setInternalExpanded(!internalExpanded));

  // Extract all business logic to hook
  const {
    isEditingLabel,
    labelDraft,
    startEditingLabel,
    commitLabel,
    cancelLabel,
    setLabelDraft,
    allSubNodes,
    hasSubNodes,
    handleAddSub,
    handleDelete,
    handleSubNodeChange
  } = useNodeCardLogic({
    node,
    nodeId,
    onNodeChange,
    onAddSubNode: contextActions.addSubNode,
    onDeleteNode: contextActions.deleteNode
  });

  const indentStyle = depth > 0 ? { marginLeft: `${depth * 20}px` } : {};

  return (
    <div
      className="border border-gray-700 rounded-lg bg-gray-900 mb-2"
      style={indentStyle}
    >
      {/* Header */}
      <NodeCardHeader
        node={node}
        nodeId={nodeId}
        progress={progress}
        isEditing={isEditingLabel}
        labelDraft={labelDraft}
        onLabelChange={setLabelDraft}
        onLabelCommit={handleLabelCommit}
        onLabelCancel={handleLabelCancel}
        onEdit={() => setIsEditingLabel(true)}
        onAddSub={handleAddSub}
        onDelete={handleDelete}
        onCompleteAuto={() => contextActions.onCompleteAuto?.(nodeId)}
        onEditManual={() => contextActions.onEditManual?.(nodeId)}
        onMarkForLater={() => contextActions.onMarkForLater?.(nodeId)}
        onChipClick={(step) => contextActions.onChipClick?.(nodeId, step)}
        showActions={!isRoot || depth > 0}
        compact={compact}
      />

      {/* Progress Indicator */}
      {showProgress && progress && (
        <div className="px-3 py-2 bg-gray-800 border-b border-gray-700">
          <NodeCardProgress
            nodeLabel={node.label}
            progress={progress}
          />
        </div>
      )}

      {/* Sub-nodes (recursive) */}
      {hasSubNodes && (
        <NodeCardContent
          node={node}
          nodeId={nodeId}
          depth={depth}
          allSubNodes={allSubNodes}
          expanded={expanded}
          onToggleExpand={toggleExpand}
          progressMap={progress ? new Map([[nodeId, progress]]) : undefined}
          onNodeChange={handleSubNodeChange}
          onAddSubNode={contextActions.addSubNode}
          onDeleteNode={handleDelete}
          onCompleteAuto={contextActions.onCompleteAuto}
          onEditManual={contextActions.onEditManual}
          onMarkForLater={contextActions.onMarkForLater}
          onChipClick={contextActions.onChipClick}
          showProgress={showProgress}
          compact={compact}
        />
      )}
    </div>
  );
}

// Memoize to prevent unnecessary re-renders in recursive tree
export default memo(NodeCard);
