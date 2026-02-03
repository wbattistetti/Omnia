// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { EngineType } from '../../types/semanticContract';
import type { TreeAnalysis } from './analyzeTree';
import type { EngineProposal } from './proposeEngines';

/**
 * Generation plan for wizard
 */
export interface GenerationPlan {
  nodesToGenerate: Array<{
    nodeId: string;
    nodeLabel: string;
    generateContract: boolean;
    generateEngines: EngineType[];
    generateEscalation: boolean;
    generateTests: boolean;
  }>;
  totalSteps: number;
}

/**
 * Build generation plan from analysis and proposals
 * Pure function: input → output, no side effects
 */
export function buildGenerationPlan(
  analysis: TreeAnalysis,
  proposals: EngineProposal[],
  userSelection?: { nodeIds: string[] }
): GenerationPlan {
  const nodesToGenerate: GenerationPlan['nodesToGenerate'] = [];

  // Determine which nodes to generate
  const nodesToProcess = userSelection?.nodeIds
    ? analysis.allNodes.filter(n => userSelection.nodeIds.includes(n.nodeId))
    : analysis.allNodes.filter(n => !n.hasContract || !n.hasEngines);

  for (const nodeAnalysis of nodesToProcess) {
    const proposal = proposals.find(p => p.nodeId === nodeAnalysis.nodeId);
    const generateContract = !nodeAnalysis.hasContract;
    const generateEngines = proposal?.engines.filter(e => e.enabled).map(e => e.type) || [];
    const generateEscalation = !nodeAnalysis.hasEngines;
    const generateTests = true; // Always generate tests

    nodesToGenerate.push({
      nodeId: nodeAnalysis.nodeId,
      nodeLabel: nodeAnalysis.nodeLabel,
      generateContract,
      generateEngines,
      generateEscalation,
      generateTests
    });
  }

  // Calculate total steps (contract + engines + escalation + tests for each node)
  const totalSteps = nodesToGenerate.reduce((sum, node) => {
    let steps = 0;
    if (node.generateContract) steps += 1;
    steps += node.generateEngines.length;
    if (node.generateEscalation) steps += 1;
    if (node.generateTests) steps += 1;
    return sum + steps;
  }, 0);

  return {
    nodesToGenerate,
    totalSteps
  };
}
