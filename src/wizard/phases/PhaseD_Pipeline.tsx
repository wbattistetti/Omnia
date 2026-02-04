// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Phase D: Pipeline Execution
 *
 * Handles:
 * - Execution of STEP 1-7 pipeline for nodes in AI mode
 * - Real-time progress tracking per node
 * - Error handling and retry
 * - Completion handling
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { SchemaNode } from '../types/wizard.types';
import { getNodesInAIMode } from '../state/modeState';
import { PipelineOrchestrator } from '../services/pipeline/PipelineOrchestrator';
import NodeCardTree from '../components/tree/NodeCardTree';

interface PhaseD_PipelineProps {
  rootLabel: string;
  structure: SchemaNode[];
  onProgressUpdate: (nodeId: string, progress: any) => void;
  onNodeResult: (nodeId: string, result: any) => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

export default function PhaseD_Pipeline({
  rootLabel,
  structure,
  onProgressUpdate,
  onNodeResult,
  onComplete,
  onError
}: PhaseD_PipelineProps) {
  const [progressMap, setProgressMap] = useState<Map<string, any>>(new Map());
  const [results, setResults] = useState<Map<string, any>>(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [completed, setCompleted] = useState(false);

  const aiNodes = getNodesInAIMode(structure);

  useEffect(() => {
    if (aiNodes.length === 0) {
      // No AI nodes - skip pipeline
      setCompleted(true);
      onComplete();
      return;
    }

    // Create orchestrator and execute
    setIsRunning(true);
    const orchestrator = new PipelineOrchestrator({
      structure,
      onProgressUpdate: (nodeId, progress) => {
        setProgressMap(prev => {
          const updated = new Map(prev);
          updated.set(nodeId, progress);
          return updated;
        });
        onProgressUpdate(nodeId, progress);
      },
      onNodeResult: (nodeId, result) => {
        setResults(prev => {
          const updated = new Map(prev);
          updated.set(nodeId, result);
          return updated;
        });
        onNodeResult(nodeId, result);
      },
      onComplete: () => {
        setIsRunning(false);
        setCompleted(true);
        onComplete();
      },
      onError: (nodeId, error) => {
        onError(`Error generating node ${nodeId}: ${error}`);
      }
    });

    orchestrator.execute().then((executionResult) => {
      setProgressMap(orchestrator.getProgressMap());
      setResults(orchestrator.getResults());
    });
  }, []); // Run once on mount

  if (aiNodes.length === 0) {
    return (
      <div className="p-4 text-center text-gray-400">
        <p>No nodes in AI mode. Skipping pipeline.</p>
        <button
          onClick={onComplete}
          className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
        >
          Continue
        </button>
      </div>
    );
  }

  const allCompleted = Array.from(results.values()).every(r => r.success !== false);
  const hasErrors = Array.from(results.values()).some(r => r.success === false);

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
        <div className="flex items-center gap-3">
          {isRunning ? (
            <>
              <Loader2 className="animate-spin text-yellow-400" size={24} />
              <div>
                <p className="text-white font-semibold">Generating logic for {aiNodes.length} node(s)...</p>
                <p className="text-gray-400 text-sm">This may take a few moments</p>
              </div>
            </>
          ) : completed ? (
            <>
              {hasErrors ? (
                <>
                  <AlertCircle className="text-red-400" size={24} />
                  <div>
                    <p className="text-white font-semibold">Generation completed with errors</p>
                    <p className="text-gray-400 text-sm">Some nodes failed to generate</p>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle className="text-green-400" size={24} />
                  <div>
                    <p className="text-white font-semibold">Generation completed successfully!</p>
                    <p className="text-gray-400 text-sm">All nodes have been processed</p>
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Structure with Progress */}
      <div className="border border-gray-700 rounded-lg p-4 bg-gray-900">
        <NodeCardTree
          rootLabel={rootLabel}
          structure={structure}
          progressMap={progressMap}
          showProgress={true}
        />
      </div>

      {/* Completion Message */}
      {completed && (
        <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
          <p className="text-blue-300 font-semibold mb-2">Generation complete!</p>
          <p className="text-blue-200 text-sm">
            This template might have general value. Please verify messages in the editor first.
          </p>
        </div>
      )}
    </div>
  );
}
