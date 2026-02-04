// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Phase B: Iteration Feedback
 *
 * Handles:
 * - User feedback collection
 * - Structure regeneration based on feedback
 * - Manual editing option
 * - Abandon option
 */

import React, { useState } from 'react';
import { RefreshCw, Wrench, X } from 'lucide-react';
import type { SchemaNode } from '../types/wizard.types';
import { useStructureGeneration } from '../hooks/useStructureGeneration';
import NodeCardTree from '../components/tree/NodeCardTree';

interface PhaseB_IterationFeedbackProps {
  taskLabel: string;
  rootLabel: string;
  previousStructure: SchemaNode[];
  onStructureRegenerated: (structure: SchemaNode[]) => void;
  onManualEdit: () => void;
  onAbandon: () => void;
  onStructureChange: (structure: SchemaNode[]) => void;
}

export default function PhaseB_IterationFeedback({
  taskLabel,
  rootLabel,
  previousStructure,
  onStructureRegenerated,
  onManualEdit,
  onAbandon,
  onStructureChange
}: PhaseB_IterationFeedbackProps) {
  const [feedback, setFeedback] = useState('');
  const { loading, error, regenerate } = useStructureGeneration();
  const [regeneratedStructure, setRegeneratedStructure] = useState<SchemaNode[] | null>(null);

  const handleRegenerate = async () => {
    if (!feedback.trim()) {
      alert('Please provide feedback before regenerating.');
      return;
    }

    const result = await regenerate(taskLabel, feedback, previousStructure);
    if (result.success && result.structure) {
      setRegeneratedStructure(result.structure);
      onStructureRegenerated(result.structure);
    }
  };

  const displayStructure = regeneratedStructure || previousStructure;

  return (
    <div className="space-y-4">
      {/* Feedback Input */}
      <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          What's wrong or how should the structure be?
        </label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Example: 'The date should have separate fields for day, month, and year' or 'Add a field for the time zone'"
          className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          rows={4}
        />
      </div>

      {/* Current Structure Display */}
      {displayStructure.length > 0 && (
        <div className="border border-gray-700 rounded-lg p-4 bg-gray-900">
          <p className="text-sm text-gray-400 mb-2">
            {regeneratedStructure ? 'New structure proposal:' : 'Current structure:'}
          </p>
          <NodeCardTree
            rootLabel={rootLabel}
            structure={displayStructure}
            onNodeChange={(nodeId, node) => {
              const updated = displayStructure.map(n => n.id === nodeId ? node : n);
              if (regeneratedStructure) {
                setRegeneratedStructure(updated);
              }
              onStructureChange(updated);
            }}
            showProgress={false}
          />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
          <p className="text-red-400 font-semibold">Error regenerating structure</p>
          <p className="text-red-300 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-4 justify-center flex-wrap">
        <button
          onClick={handleRegenerate}
          disabled={loading || !feedback.trim()}
          className="flex items-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
          title="AI will regenerate a new proposal based on your feedback"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Retry
        </button>
        <button
          onClick={onManualEdit}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
          title="Open advanced editor to define data structure manually"
        >
          <Wrench size={18} />
          Build manually
        </button>
        <button
          onClick={onAbandon}
          className="flex items-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition-colors"
          title="Exit without generating data structure"
        >
          <X size={18} />
          Abandon
        </button>
      </div>
    </div>
  );
}
