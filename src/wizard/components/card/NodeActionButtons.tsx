// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Node Action Buttons Component
 *
 * Action buttons for a node card (Edit, Add sub, Delete, etc.).
 * Only shown on hover.
 */

import React from 'react';
import { Pencil, Plus, Trash2, Bot, Edit, Clock } from 'lucide-react';
import type { NodeMode } from '../../types/wizard.types';

interface NodeActionButtonsProps {
  nodeMode?: NodeMode;
  onEdit?: () => void;
  onAddSub?: () => void;
  onDelete?: () => void;
  onCompleteAuto?: () => void;
  onEditManual?: () => void;
  onMarkForLater?: () => void;
}

export default function NodeActionButtons({
  nodeMode,
  onEdit,
  onAddSub,
  onDelete,
  onCompleteAuto,
  onEditManual,
  onMarkForLater
}: NodeActionButtonsProps) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {onEdit && (
        <button
          onClick={onEdit}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
          title="Edit label"
        >
          <Pencil size={14} />
        </button>
      )}
      {onAddSub && (
        <button
          onClick={onAddSub}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
          title="Add sub-node"
        >
          <Plus size={14} />
        </button>
      )}
      {onCompleteAuto && nodeMode !== 'ai' && (
        <button
          onClick={onCompleteAuto}
          className="p-1.5 text-yellow-400 hover:text-yellow-300 hover:bg-gray-700 rounded"
          title="Complete automatically (AI)"
        >
          <Bot size={14} />
        </button>
      )}
      {onEditManual && nodeMode !== 'manual' && (
        <button
          onClick={onEditManual}
          className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded"
          title="Edit manually"
        >
          <Edit size={14} />
        </button>
      )}
      {onMarkForLater && nodeMode !== 'postponed' && (
        <button
          onClick={onMarkForLater}
          className="p-1.5 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded"
          title="Mark for later"
        >
          <Clock size={14} />
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded"
          title="Delete node"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
