// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Node Card Tree Component
 *
 * Container for the tree of node cards.
 * Always shows root card, with children nested underneath.
 * Replaces MainDataCollection.
 */

import React from 'react';
import { Folder } from 'lucide-react';
import type { SchemaNode } from '../../types/wizard.types';
import type { NodePipelineProgress } from '../../types/pipeline.types';
import NodeCard from '../card/NodeCard';

interface NodeCardTreeProps {
  rootLabel: string;
  structure: SchemaNode[];
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

export default function NodeCardTree({
  rootLabel,
  structure,
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
}: NodeCardTreeProps) {
  // Create root node from structure
  const rootNode: SchemaNode = {
    id: 'root',
    label: rootLabel,
    icon: 'folder',
    subData: structure.length > 0 ? structure : undefined,
    subTasks: structure.length > 0 ? structure : undefined
  };

  const rootProgress = progressMap?.get('root');

  return (
    <div className="space-y-2">
      {/* Root Card - Always visible */}
      <div className="border border-purple-600 rounded-lg bg-gray-900">
        <div className="flex items-center gap-2 p-3 border-b border-purple-600">
          <Folder size={18} className="text-purple-400" />
          <span className="font-bold text-purple-300">{rootLabel}</span>
        </div>

        {/* Main nodes as children of root */}
        {structure.length > 0 ? (
          <div className="p-2 space-y-2">
            {structure.map((node, index) => {
              const nodeId = node.id || `node-${index}`;
              const progress = progressMap?.get(nodeId);

              return (
                <NodeCard
                  key={nodeId}
                  node={node}
                  nodeId={nodeId}
                  depth={0}
                  progress={progress}
                  onNodeChange={onNodeChange}
                  onAddSubNode={onAddSubNode}
                  onDeleteNode={onDeleteNode}
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
        ) : (
          <div className="p-4 text-center text-gray-400 italic">
            No nodes yet. Add nodes to build the structure.
          </div>
        )}
      </div>
    </div>
  );
}
