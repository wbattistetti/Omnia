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

  // Calculate total steps for internal pipeline (STEP 1-7)
  // Each node goes through: Contract → Refinement → Canonical → Constraints → Engines → Escalation → Tests → AI Messages
  const totalSteps = nodesToGenerate.reduce((sum, node) => {
    let steps = 0;
    // STEP 1: Contract generation (if needed) + Contract refinement (always)
    if (node.generateContract) steps += 1; // Contract generation
    steps += 1; // Contract refinement (always)
    // STEP 2: Canonical values (always)
    steps += 1;
    // STEP 3: Constraints (always)
    steps += 1;
    // STEP 4: Engines unified (always, replaces individual engine generation)
    steps += 1;
    // STEP 5: Escalation (if needed)
    if (node.generateEscalation) steps += 1;
    // STEP 6: Test examples (always)
    if (node.generateTests) steps += 1;
    // STEP 7: AI messages (always)
    steps += 1;
    return sum + steps;
  }, 0);

  return {
    nodesToGenerate,
    totalSteps
  };
}
