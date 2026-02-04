// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Node Label Component
 *
 * Editable label for a node card.
 * Handles editing state and keyboard shortcuts.
 */

import React from 'react';
import { Check, X } from 'lucide-react';

interface NodeLabelProps {
  label: string;
  isEditing: boolean;
  labelDraft: string;
  onLabelChange: (label: string) => void;
  onLabelCommit: () => void;
  onLabelCancel: () => void;
}

export default function NodeLabel({
  label,
  isEditing,
  labelDraft,
  onLabelChange,
  onLabelCommit,
  onLabelCancel
}: NodeLabelProps) {
  if (isEditing) {
    return (
      <div className="flex items-center gap-2 flex-1">
        <input
          autoFocus
          value={labelDraft}
          onChange={(e) => onLabelChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onLabelCommit();
            } else if (e.key === 'Escape') {
              onLabelCancel();
            }
          }}
          className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white"
          placeholder="Node label..."
        />
        <button
          onClick={onLabelCommit}
          className="p-1 text-green-500 hover:text-green-400"
          title="Confirm"
        >
          <Check size={16} />
        </button>
        <button
          onClick={onLabelCancel}
          className="p-1 text-red-500 hover:text-red-400"
          title="Cancel"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <span className="font-semibold text-white truncate">{label}</span>
  );
}
