// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useEffect, useCallback } from 'react';
import { X, Check, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import type { TaskTree } from '@types/taskTypes';
import type { TreeAnalysis, GenerationPlan, GenerationProgress, NodeGenerationResult } from '@utils/contractWizardOrchestrator';
import { analyzeTree, proposeEngines, buildGenerationPlan, executeGenerationPlan } from '@utils/contractWizardOrchestrator';

interface ContractWizardProps {
  taskTree: TaskTree | null;
  onClose: () => void;
  onComplete?: (results: Map<string, NodeGenerationResult>) => void;
  onNodeUpdate?: (nodeId: string) => void; // ✅ NEW: Callback to refresh node in Sidebar
  integrated?: boolean; // ✅ NEW: If true, render as integrated component (not modal)
}

type WizardStep = 'analyzing' | 'proposal' | 'generating' | 'complete';

export default function ContractWizard({ taskTree, onClose, onComplete, onNodeUpdate, integrated = false }: ContractWizardProps) {
  const [step, setStep] = useState<WizardStep>('analyzing');
  const [analysis, setAnalysis] = useState<TreeAnalysis | null>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [plan, setPlan] = useState<GenerationPlan | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [results, setResults] = useState<Map<string, NodeGenerationResult>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // Step 1: Analyze tree
  useEffect(() => {
    if (step === 'analyzing' && taskTree) {
      analyzeTree(taskTree)
        .then((analysisResult) => {
          setAnalysis(analysisResult);
          const engineProposals = proposeEngines(analysisResult, taskTree);
          setProposals(engineProposals);

          // Auto-select all nodes that need generation
          const nodesToGenerate = analysisResult.allNodes.filter(
            n => !n.hasContract || !n.hasEngines
          );
          setSelectedNodeIds(new Set(nodesToGenerate.map(n => n.nodeId)));

          setStep('proposal');
        })
        .catch((err) => {
          console.error('[ContractWizard] Analysis failed:', err);
          setError(`Analysis failed: ${err.message}`);
        });
    }
  }, [step, taskTree]);

  const handleNodeToggle = useCallback((nodeId: string) => {
    setSelectedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!analysis) return;
    const nodesToGenerate = analysis.allNodes.filter(
      n => !n.hasContract || !n.hasEngines
    );
    setSelectedNodeIds(new Set(nodesToGenerate.map(n => n.nodeId)));
  }, [analysis]);

  const handleDeselectAll = useCallback(() => {
    setSelectedNodeIds(new Set());
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!analysis || !taskTree || selectedNodeIds.size === 0) {
      return;
    }

    // Build plan
    const generationPlan = buildGenerationPlan(analysis, proposals, {
      nodeIds: Array.from(selectedNodeIds)
    });
    setPlan(generationPlan);
    setStep('generating');

    try {
      // Execute plan
      const generationResults = await executeGenerationPlan(
        generationPlan,
        taskTree,
        (progressUpdate) => {
          setProgress(progressUpdate);
          // ✅ Update node in Sidebar in real-time
          if (onNodeUpdate && progressUpdate.currentNodeId) {
            onNodeUpdate(progressUpdate.currentNodeId);
          }
        }
      );

      setResults(generationResults);
      setStep('complete');

      // ✅ Final update for all nodes
      if (onNodeUpdate) {
        for (const nodeId of generationResults.keys()) {
          onNodeUpdate(nodeId);
        }
      }

      if (onComplete) {
        onComplete(generationResults);
      }
    } catch (err: any) {
      console.error('[ContractWizard] Generation failed:', err);
      setError(`Generation failed: ${err.message}`);
    }
  }, [analysis, taskTree, selectedNodeIds, proposals, onComplete]);

  if (!taskTree) {
    return (
      <div style={{ padding: '20px', color: '#e5e7eb' }}>
        <p>No task tree available for analysis.</p>
        <button onClick={onClose} style={{ marginTop: '10px', padding: '8px 16px' }}>
          Close
        </button>
      </div>
    );
  }

  // ✅ Integrated mode: render as panel, not modal
  const containerStyle: React.CSSProperties = integrated
    ? {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1f2937',
        border: '1px solid rgba(156, 163, 175, 0.3)',
        borderRadius: '8px',
        overflow: 'hidden',
        minHeight: 0,
      }
    : {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      };

  const dialogStyle: React.CSSProperties = integrated
    ? {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
      }
    : {
        backgroundColor: '#1f2937',
        border: '1px solid rgba(156, 163, 175, 0.3)',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      };

  return (
    <div style={containerStyle}>
      {!integrated && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 9999
        }} onClick={onClose} />
      )}
      <div style={{
        ...dialogStyle,
        zIndex: integrated ? 1 : 10000,
        position: integrated ? 'relative' : 'relative',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid rgba(156, 163, 175, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Sparkles size={24} color="#60a5fa" />
            <h2 style={{ margin: 0, color: '#e5e7eb', fontSize: '20px', fontWeight: 600 }}>
              Contract & Parser Generation Wizard
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {step === 'analyzing' && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#e5e7eb' }}>
              <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              <p>Analyzing task tree structure...</p>
            </div>
          )}

          {step === 'proposal' && analysis && (
            <div>
              <div style={{ marginBottom: '20px', color: '#e5e7eb' }}>
                <p style={{ marginBottom: '12px' }}>
                  I've analyzed the task tree structure. I found:
                </p>
                <ul style={{ marginLeft: '20px', marginBottom: '16px' }}>
                  <li>
                    <strong>{analysis.nodesWithoutContract.length}</strong> nodes without semantic contract
                  </li>
                  <li>
                    <strong>{analysis.nodesWithoutEngines.length}</strong> nodes without parser engines
                  </li>
                  {analysis.nodesWithIncompleteContract.length > 0 && (
                    <li>
                      <strong>{analysis.nodesWithIncompleteContract.length}</strong> nodes with incomplete contracts
                    </li>
                  )}
                </ul>
                <p style={{ marginBottom: '16px' }}>
                  I can automatically generate:
                </p>
                <ul style={{ marginLeft: '20px', marginBottom: '20px' }}>
                  <li>Semantic Contract for each node</li>
                  <li>Parser engines (Regex, NER, Rule-based, LLM, Embedding) based on entity type</li>
                  <li>Engine escalation sequence</li>
                  <li>Test examples</li>
                </ul>
                <p style={{ marginBottom: '16px', fontStyle: 'italic', color: '#9ca3af' }}>
                  You can modify everything manually afterwards.
                </p>
              </div>

              {/* Node selection */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, color: '#e5e7eb', fontSize: '16px' }}>
                    Select nodes to generate:
                  </h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleSelectAll}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        background: 'rgba(96, 165, 250, 0.2)',
                        border: '1px solid rgba(96, 165, 250, 0.5)',
                        color: '#60a5fa',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={handleDeselectAll}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        background: 'rgba(156, 163, 175, 0.2)',
                        border: '1px solid rgba(156, 163, 175, 0.5)',
                        color: '#9ca3af',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div style={{
                  maxHeight: '300px',
                  overflow: 'auto',
                  border: '1px solid rgba(156, 163, 175, 0.3)',
                  borderRadius: '4px',
                  padding: '8px'
                }}>
                  {analysis.allNodes.map((node) => {
                    const needsGeneration = !node.hasContract || !node.hasEngines;
                    const isSelected = selectedNodeIds.has(node.nodeId);
                    const proposal = proposals.find(p => p.nodeId === node.nodeId);

                    return (
                      <div
                        key={node.nodeId}
                        style={{
                          padding: '8px',
                          marginBottom: '4px',
                          backgroundColor: isSelected ? 'rgba(96, 165, 250, 0.1)' : 'transparent',
                          border: `1px solid ${isSelected ? 'rgba(96, 165, 250, 0.3)' : 'transparent'}`,
                          borderRadius: '4px',
                          cursor: needsGeneration ? 'pointer' : 'default',
                          opacity: needsGeneration ? 1 : 0.5
                        }}
                        onClick={() => needsGeneration && handleNodeToggle(node.nodeId)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => needsGeneration && handleNodeToggle(node.nodeId)}
                            disabled={!needsGeneration}
                            style={{ cursor: needsGeneration ? 'pointer' : 'not-allowed' }}
                          />
                          <span style={{ color: '#e5e7eb', flex: 1 }}>
                            {node.nodeLabel}
                            {node.isComposite && ` (${node.subNodesCount} sub-nodes)`}
                          </span>
                          <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#9ca3af' }}>
                            {!node.hasContract && (
                              <span style={{ color: '#f87171' }}>No Contract</span>
                            )}
                            {!node.hasEngines && (
                              <span style={{ color: '#f87171' }}>No Engines</span>
                            )}
                            {node.hasContract && node.hasEngines && (
                              <span style={{ color: '#34d399' }}>Complete</span>
                            )}
                          </div>
                        </div>
                        {isSelected && proposal && (
                          <div style={{ marginTop: '8px', marginLeft: '24px', fontSize: '12px', color: '#9ca3af' }}>
                            Engines: {proposal.engines.filter((e: any) => e.enabled).map((e: any) => e.type).join(' → ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div style={{
                  padding: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '4px',
                  color: '#fca5a5',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {step === 'generating' && progress && (
            <div style={{ color: '#e5e7eb' }}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Generating contracts and parsers...</span>
                  <span>{progress.currentStep} / {progress.totalSteps}</span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: 'rgba(156, 163, 175, 0.2)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${progress.percentage}%`,
                    height: '100%',
                    backgroundColor: '#60a5fa',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'rgba(96, 165, 250, 0.1)', borderRadius: '4px' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                  {progress.currentNodeLabel}
                </div>
                <div style={{ fontSize: '14px', color: '#9ca3af' }}>
                  {progress.currentAction}
                </div>
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div style={{ color: '#e5e7eb' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px',
                padding: '12px',
                backgroundColor: 'rgba(34, 211, 153, 0.1)',
                border: '1px solid rgba(34, 211, 153, 0.3)',
                borderRadius: '4px'
              }}>
                <Check size={24} color="#34d399" />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                    Generation Complete!
                  </div>
                  <div style={{ fontSize: '14px', color: '#9ca3af' }}>
                    {results.size} nodes processed
                  </div>
                </div>
              </div>

              {/* Results summary */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>Results:</h3>
                <div style={{
                  maxHeight: '200px',
                  overflow: 'auto',
                  border: '1px solid rgba(156, 163, 175, 0.3)',
                  borderRadius: '4px',
                  padding: '8px'
                }}>
                  {Array.from(results.entries()).map(([nodeId, result]) => (
                    <div
                      key={nodeId}
                      style={{
                        padding: '8px',
                        marginBottom: '4px',
                        backgroundColor: result.success ? 'rgba(34, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${result.success ? 'rgba(34, 211, 153, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        borderRadius: '4px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        {result.success ? (
                          <Check size={16} color="#34d399" />
                        ) : (
                          <AlertCircle size={16} color="#f87171" />
                        )}
                        <span style={{ fontWeight: 600 }}>{nodeId}</span>
                      </div>
                      {result.contract && (
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '24px' }}>
                          Contract: ✓
                        </div>
                      )}
                      {result.engines && result.engines.size > 0 && (
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginLeft: '24px' }}>
                          Engines: {Array.from(result.engines.keys()).join(', ')}
                        </div>
                      )}
                      {result.errors && result.errors.length > 0 && (
                        <div style={{ fontSize: '12px', color: '#fca5a5', marginLeft: '24px', marginTop: '4px' }}>
                          Errors: {result.errors.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid rgba(156, 163, 175, 0.3)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          {step === 'proposal' && (
            <>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(156, 163, 175, 0.2)',
                  border: '1px solid rgba(156, 163, 175, 0.5)',
                  color: '#e5e7eb',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={selectedNodeIds.size === 0}
                style={{
                  padding: '8px 16px',
                  background: selectedNodeIds.size > 0 ? '#60a5fa' : 'rgba(96, 165, 250, 0.3)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '4px',
                  cursor: selectedNodeIds.size > 0 ? 'pointer' : 'not-allowed',
                  fontWeight: 600
                }}
              >
                Generate All ({selectedNodeIds.size} nodes)
              </button>
            </>
          )}
          {step === 'complete' && (
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                background: '#60a5fa',
                border: 'none',
                color: '#fff',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
