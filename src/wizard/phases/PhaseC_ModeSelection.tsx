// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Phase C: Mode Selection
 *
 * Handles:
 * - Mode selection per node (IA/Manual/Postponed)
 * - Mode propagation to children
 * - "Start generation" button (always clickable)
 */

import React from 'react';
import { Play, Bot, Edit, Clock } from 'lucide-react';
import type { SchemaNode, NodeMode } from '../types/wizard.types';
import { useModePropagation } from '../hooks/useModePropagation';
import { hasNodesInAIMode, areAllNodesManual } from '../state/modeState';
import NodeCardTree from '../components/tree/NodeCardTree';

interface PhaseC_ModeSelectionProps {
  rootLabel: string;
  structure: SchemaNode[];
  onStructureChange: (structure: SchemaNode[]) => void;
  onStartGeneration: () => void;
}

export default function PhaseC_ModeSelection({
  rootLabel,
  structure,
  onStructureChange,
  onStartGeneration
}: PhaseC_ModeSelectionProps) {
  const { setNodeMode } = useModePropagation(structure, onStructureChange);

  const handleCompleteAuto = (nodeId: string) => {
    setNodeMode(nodeId, 'ai', true); // Propagate to children
  };

  const handleEditManual = (nodeId: string) => {
    setNodeMode(nodeId, 'manual', false); // Don't propagate
  };

  const handleMarkForLater = (nodeId: string) => {
    setNodeMode(nodeId, 'postponed', false); // Don't propagate
  };

  const hasAIModes = hasNodesInAIMode(structure);
  const allManual = areAllNodesManual(structure);

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
        <p className="text-blue-300 font-semibold mb-2">Choose generation mode for each node:</p>
        <ul className="text-blue-200 text-sm space-y-1 list-disc list-inside">
          <li>
            <strong>Complete automatically (AI):</strong> AI generates all logic (contracts, constraints, messages, engines, etc.)
          </li>
          <li>
            <strong>Edit manually:</strong> You'll fill everything manually in the editor
          </li>
          <li>
            <strong>Mark for later:</strong> Skip this node for now (equivalent to manual, but postponed)
          </li>
        </ul>
        <p className="text-blue-200 text-xs mt-2 italic">
          Note: When you choose AI mode, all child nodes automatically switch to AI mode for consistency.
        </p>
      </div>

      {/* Structure with Mode Controls */}
      <div className="border border-gray-700 rounded-lg p-4 bg-gray-900">
        <NodeCardTree
          rootLabel={rootLabel}
          structure={structure}
          onNodeChange={(nodeId, node) => {
            const updated = structure.map(n => n.id === nodeId ? node : n);
            onStructureChange(updated);
          }}
          onCompleteAuto={handleCompleteAuto}
          onEditManual={handleEditManual}
          onMarkForLater={handleMarkForLater}
          showProgress={false}
        />
      </div>

      {/* Start Generation Button - Always Clickable */}
      <div className="flex items-center justify-center">
        <button
          onClick={onStartGeneration}
          className="flex items-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-lg transition-colors shadow-lg"
        >
          <Play size={20} />
          Start Generation
        </button>
      </div>

      {/* Info Message */}
      <div className="text-center text-sm text-gray-400">
        {hasAIModes && (
          <p>
            {hasAIModes ? structure.filter(n => n.mode === 'ai').length : 0} node(s) will be generated automatically.
            {allManual ? ' All other nodes will be skipped (manual mode).' : ' Other nodes will be skipped (manual mode).'}
          </p>
        )}
        {allManual && (
          <p>
            All nodes are in manual mode. Pipeline will be skipped. You can edit nodes manually after clicking "Start Generation".
          </p>
        )}
      </div>
    </div>
  );
}
