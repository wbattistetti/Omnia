// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { TaskTreeNode } from '../../types/taskTypes';
import type { SemanticContract } from '../../types/semanticContract';
import type { GenerationProgress } from './types';

/**
 * Generate test examples for a node
 * TODO: Replace heuristic with AI call to /api/nlp/generate-test-examples
 * Side effect: calls API (when implemented)
 */
export async function generateTestExamplesForNode(
  node: TaskTreeNode,
  contract: SemanticContract,
  onProgress?: (progress: GenerationProgress) => void
): Promise<string[]> {
  const nodeId = node.id || node.templateId;

  if (onProgress) {
    onProgress({
      currentStep: 0,
      totalSteps: 1,
      currentNodeId: nodeId,
      currentNodeLabel: node.label || nodeId,
      currentAction: 'Generating test examples...',
      percentage: 0
    });
  }

  // TODO: Replace with AI call
  // const response = await fetch('/api/nlp/generate-test-examples', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     contract,
  //     nodeLabel: node.label,
  //     nodeType: node.type,
  //     constraints: node.constraints || []
  //   })
  // });
  // const data = await response.json();
  // return data.examples?.valid || [];

  // Temporary heuristic (to be replaced)
  const examples: string[] = [];
  const subentities = contract.subentities || contract.subgroups || [];

  // Generate simple examples
  if (subentities.length === 0) {
    // Simple node - generate based on type
    const type = contract.entity?.type || contract.mainGroup?.kind || 'text';
    if (type === 'email') {
      examples.push('mario.rossi@example.com', 'test@domain.it');
    } else if (type === 'phone') {
      examples.push('+39 333 1234567', '06 12345678');
    } else {
      examples.push('example value', 'test input');
    }
  } else {
    // Composite node - generate examples with all subentities
    const example1 = subentities.map(sg => {
      if (sg.subTaskKey.includes('day')) return '15';
      if (sg.subTaskKey.includes('month')) return 'aprile';
      if (sg.subTaskKey.includes('year')) return '1980';
      return 'value';
    }).join(' ');
    examples.push(example1);

    // Generate partial example (missing some fields)
    if (subentities.length > 1) {
      const partialExample = subentities.slice(0, Math.floor(subentities.length / 2))
        .map(sg => {
          if (sg.subTaskKey.includes('month')) return 'marzo';
          if (sg.subTaskKey.includes('year')) return '1990';
          return 'value';
        }).join(' ');
      examples.push(partialExample);
    }
  }

  if (onProgress) {
    onProgress({
      currentStep: 1,
      totalSteps: 1,
      currentNodeId: nodeId,
      currentNodeLabel: node.label || nodeId,
      currentAction: `Generated ${examples.length} test examples`,
      percentage: 100
    });
  }

  return examples;
}
