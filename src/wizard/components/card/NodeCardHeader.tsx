// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Node Card Header Component
 *
 * Header for a node card with:
 * - Editable label
 * - Icon
 * - Status chips (STEP 1-7)
 * - Action buttons (Edit, Add sub, Delete, Complete auto, Edit manual, Mark for later)
 */

import React, { useState, memo } from 'react';
import type { SchemaNode } from '../../types/wizard.types';
import NodeCardChips from './NodeCardChips';
import NodeLabel from './NodeLabel';
import NodeModeBadge from './NodeModeBadge';
import NodeActionButtons from './NodeActionButtons';
import type { NodePipelineProgress } from '../../types/pipeline.types';

interface NodeCardHeaderProps {
  node: SchemaNode;
  nodeId: string;
  progress?: NodePipelineProgress;
  isEditing?: boolean;
  labelDraft?: string;
  onLabelChange?: (label: string) => void;
  onLabelCommit?: () => void;
  onLabelCancel?: () => void;
  onEdit?: () => void;
  onAddSub?: () => void;
  onDelete?: () => void;
  onCompleteAuto?: () => void;
  onEditManual?: () => void;
  onMarkForLater?: () => void;
  onChipClick?: (step: string) => void;
  showActions?: boolean;
  compact?: boolean;
}

function NodeCardHeader({
  node,
  nodeId,
  progress,
  isEditing = false,
  labelDraft,
  onLabelChange,
  onLabelCommit,
  onLabelCancel,
  onEdit,
  onAddSub,
  onDelete,
  onCompleteAuto,
  onEditManual,
  onMarkForLater,
  onChipClick,
  showActions = true,
  compact = false
}: NodeCardHeaderProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex items-center gap-2 p-3 border-b border-gray-700"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Icon */}
      {node.icon && (
        <span className="text-lg">{node.icon}</span>
      )}

      {/* Label and Mode Badge */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <NodeLabel
          label={node.label}
          isEditing={isEditing}
          labelDraft={labelDraft || node.label}
          onLabelChange={onLabelChange || (() => {})}
          onLabelCommit={onLabelCommit || (() => {})}
          onLabelCancel={onLabelCancel || (() => {})}
        />
        <NodeModeBadge mode={node.mode} />
      </div>

      {/* Status Chips */}
      {!compact && (
        <div className="flex-shrink-0">
          <NodeCardChips
            nodeId={nodeId}
            progress={progress}
            onChipClick={onChipClick}
            compact={compact}
          />
        </div>
      )}

      {/* Action Buttons */}
      {showActions && hovered && !isEditing && (
        <NodeActionButtons
          nodeMode={node.mode}
          onEdit={onEdit}
          onAddSub={onAddSub}
          onDelete={onDelete}
          onCompleteAuto={onCompleteAuto}
          onEditManual={onEditManual}
          onMarkForLater={onMarkForLater}
        />
      )}
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export default memo(NodeCardHeader);
