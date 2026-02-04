// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Node Card Content Component
 *
 * Handles recursive rendering of sub-nodes.
 * Separated from NodeCard to avoid circular import issues.
 */

import React, { memo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { SchemaNode } from '../../types/wizard.types';
import type { NodePipelineProgress } from '../../types/pipeline.types';
import NodeCard from './NodeCard';

interface NodeCardContentProps {
  node: SchemaNode;
  nodeId: string;
  depth: number;
  allSubNodes: SchemaNode[];
  expanded: boolean;
  onToggleExpand: () => void;
  progressMap?: Map<string, NodePipelineProgress>;
  onNodeChange?: (nodeId: string, node: SchemaNode) => void;
  onAddSubNode?: (parentNodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onCompleteAuto?: (nodeId: string) => void;
  onEditManual?: (nodeId: string) => void;
  onMarkForLater?: (nodeId: string) => void;
  onChipClick?: (nodeId: string, step: string) => void;
  showProgress?: boolean;
  compact?: boolean;
}

function NodeCardContent({
  node,
  nodeId,
  depth,
  allSubNodes,
  expanded,
  onToggleExpand,
  progressMap,
  onNodeChange,
  onAddSubNode,
  onDeleteNode,
  onCompleteAuto,
  onEditManual,
  onMarkForLater,
  onChipClick,
  showProgress = true,
  compact = false
}: NodeCardContentProps) {
  const handleSubNodeChange = (subNodeId: string, subNode: SchemaNode) => {
    const index = allSubNodes.findIndex(n => n.id === subNodeId);
    if (index === -1) return;

    const updatedSubNodes = [...allSubNodes];
    updatedSubNodes[index] = subNode;

    const subData = node.subData || [];
    const subTasks = node.subTasks || [];

    const updatedNode = {
      ...node,
      subData: subTasks.length > 0 ? undefined : updatedSubNodes,
      subTasks: subTasks.length > 0 ? updatedSubNodes : undefined
    };

    onNodeChange?.(nodeId, updatedNode);
  };

  return (
    <div>
      <button
        onClick={onToggleExpand}
        className="w-full px-3 py-2 flex items-center gap-2 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
      >
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="text-sm">
          {allSubNodes.length} sub-node{allSubNodes.length !== 1 ? 's' : ''}
        </span>
      </button>

      {expanded && (
        <div className="p-2 space-y-2">
          {allSubNodes.map((subNode, index) => {
            const subNodeId = subNode.id || `${nodeId}-sub-${index}`;
            const progress = progressMap?.get(subNodeId);

            return (
              <NodeCard
                key={subNodeId}
                node={subNode}
                nodeId={subNodeId}
                depth={depth + 1}
                progress={progress}
                onNodeChange={handleSubNodeChange}
                onAddSubNode={onAddSubNode}
                onDeleteNode={(id) => {
                  const updatedSubNodes = allSubNodes.filter(n => (n.id || '') !== id);
                  const subData = node.subData || [];
                  const subTasks = node.subTasks || [];
                  const updatedNode = {
                    ...node,
                    subData: subTasks.length > 0 ? undefined : updatedSubNodes,
                    subTasks: subTasks.length > 0 ? updatedSubNodes : undefined
                  };
                  onNodeChange?.(nodeId, updatedNode);
                }}
                onCompleteAuto={onCompleteAuto}
                onEditManual={onEditManual}
                onMarkForLater={onMarkForLater}
                onChipClick={onChipClick}
                showProgress={showProgress}
                compact={compact}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// Memoize to prevent unnecessary re-renders in recursive tree
export default memo(NodeCardContent);
