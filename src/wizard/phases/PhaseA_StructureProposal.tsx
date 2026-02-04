// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Phase A: Structure Proposal
 *
 * Handles:
 * - Template search
 * - Structure generation if template not found
 * - Structure proposal display
 * - User approval/rejection
 */

import React, { useEffect } from 'react';
import { Loader2, Check, X } from 'lucide-react';
import type { SchemaNode } from '../types/wizard.types';
import { useTemplateSearch } from '../hooks/useTemplateSearch';
import { useStructureGeneration } from '../hooks/useStructureGeneration';
import NodeCardTree from '../components/tree/NodeCardTree';

interface PhaseA_StructureProposalProps {
  taskLabel: string;
  rootLabel: string;
  structure: SchemaNode[];
  onStructureApproved: (structure: SchemaNode[]) => void;
  onStructureRejected: () => void;
  onStructureChange: (structure: SchemaNode[]) => void;
}

export default function PhaseA_StructureProposal({
  taskLabel,
  rootLabel,
  structure,
  onStructureApproved,
  onStructureRejected,
  onStructureChange
}: PhaseA_StructureProposalProps) {
  const { loading: searchLoading, result: searchResult, found: templateFound } = useTemplateSearch(taskLabel);
  const { loading: genLoading, error: genError, generate } = useStructureGeneration();

  const [proposedStructure, setProposedStructure] = React.useState<SchemaNode[]>(structure);
  const [hasGenerated, setHasGenerated] = React.useState(false);

  // Generate structure if template not found
  useEffect(() => {
    if (!searchLoading && !templateFound && !hasGenerated && proposedStructure.length === 0) {
      generate(taskLabel).then(result => {
        if (result.success && result.structure) {
          setProposedStructure(result.structure);
          setHasGenerated(true);
        }
      });
    }
  }, [searchLoading, templateFound, hasGenerated, proposedStructure.length, taskLabel, generate]);

  const loading = searchLoading || genLoading;
  const hasStructure = proposedStructure.length > 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="animate-spin text-purple-400" size={32} />
        <p className="text-gray-300">
          {searchLoading ? 'Searching for template...' : 'Generating structure data...'}
        </p>
      </div>
    );
  }

  if (genError) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
        <p className="text-red-400 font-semibold">Error generating structure</p>
        <p className="text-red-300 text-sm mt-1">{genError}</p>
        <button
          onClick={() => {
            setHasGenerated(false);
            generate(taskLabel);
          }}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!hasStructure) {
    return (
      <div className="p-4 text-center text-gray-400">
        <p>No structure available. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Message */}
      {!templateFound && (
        <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
          <p className="text-blue-300">
            No suitable template found for task "{taskLabel}".
          </p>
          <p className="text-blue-200 text-sm mt-1">
            I've identified the best data structure:
          </p>
        </div>
      )}

      {/* Structure Display */}
      <div className="border border-gray-700 rounded-lg p-4 bg-gray-900">
        <NodeCardTree
          rootLabel={rootLabel}
          structure={proposedStructure}
          onNodeChange={(nodeId, node) => {
            // Update structure when node changes
            const updated = proposedStructure.map(n => n.id === nodeId ? node : n);
            setProposedStructure(updated);
            onStructureChange(updated);
          }}
          showProgress={false}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-4 justify-center">
        <button
          onClick={() => onStructureApproved(proposedStructure)}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
        >
          <Check size={18} />
          Looks good
        </button>
        <button
          onClick={onStructureRejected}
          className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
        >
          <X size={18} />
          Not good
        </button>
      </div>

      {!templateFound && (
        <p className="text-xs text-gray-500 text-center mt-2">
          Tip: I'll proceed to generate complete logic for each field.
        </p>
      )}
    </div>
  );
}
