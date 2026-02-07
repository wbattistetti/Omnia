import { FakeTaskTreeNode, FakeConstraint, FakeNLPContract, FakeStepMessages } from '../types';
import { delayBySeconds } from '../utils/delays';
import {
  generateMockDataNodes,
  generateMockConstraints,
  generateMockContract,
  generateMockMessages
} from '../utils/mockData';

export type ParserDiscovery = {
  nodeId: string;
  parsersCount: number;
};

export async function fakeGenerateStructure(
  description: string,
  taskTime: number = 3
): Promise<FakeTaskTreeNode[]> {
  await delayBySeconds(taskTime);
  return generateMockDataNodes(description);
}

/**
 * Easing function (ease-out)
 * Trasforma un valore lineare 0-1 in un valore con easing
 */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Simula il progresso con aggiornamenti fluidi ed easing
 */
async function simulateProgressWithEasing(
  baseTime: number,
  multiplier: number,
  onProgress: (progress: number) => void
): Promise<void> {
  const duration = baseTime * multiplier * (0.9 + Math.random() * (multiplier === 0.5 ? 0.2 : multiplier === 1.0 ? 0.3 : 0.4));
  const steps = 20;
  const interval = (duration * 1000) / steps;

  for (let i = 0; i <= steps; i++) {
    const linearProgress = i / steps;
    const easedProgress = easeOut(linearProgress);
    onProgress(easedProgress * 100);

    if (i < steps) {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
}

export async function fakeGenerateConstraints(
  schema: FakeTaskTreeNode[],
  taskTime: number = 3,
  onProgress?: (progress: number) => void
): Promise<FakeConstraint[]> {
  if (onProgress) {
    await simulateProgressWithEasing(taskTime, 0.5, onProgress);
  } else {
    const duration = taskTime * 0.5 * (0.9 + Math.random() * 0.2);
    await delayBySeconds(duration);
  }
  return generateMockConstraints([]);
}

export async function fakeGenerateParsers(
  schema: FakeTaskTreeNode[],
  taskTime: number = 3,
  onProgress?: (progress: number) => void
): Promise<FakeNLPContract> {
  if (onProgress) {
    await simulateProgressWithEasing(taskTime, 1.0, onProgress);
  } else {
    const duration = taskTime * 1.0 * (0.9 + Math.random() * 0.3);
    await delayBySeconds(duration);
  }
  return generateMockContract([]);
}

export async function fakeGenerateMessages(
  schema: FakeTaskTreeNode[],
  taskTime: number = 3,
  onProgress?: (progress: number) => void
): Promise<FakeStepMessages> {
  if (onProgress) {
    await simulateProgressWithEasing(taskTime, 1.5, onProgress);
  } else {
    const duration = taskTime * 1.5 * (0.9 + Math.random() * 0.4);
    await delayBySeconds(duration);
  }
  return generateMockMessages([]);
}

export async function discoverParsers(
  schema: FakeTaskTreeNode[]
): Promise<ParserDiscovery[]> {
  // Simulazione: ogni nodo può avere un numero variabile di parser
  // In base al tipo di nodo, decidiamo quanti parser servono
  const discoveries: ParserDiscovery[] = [];

  const analyzeNode = (node: FakeTaskTreeNode) => {
    let parsersCount = 1; // default: almeno 1 parser per nodo

    // Logica di discovery: alcuni tipi richiedono più parser
    if (node.type === 'object') {
      parsersCount = 2; // parser strutturato + validatore
    } else if (node.type === 'number') {
      parsersCount = 2; // parser numerico + range validator
    } else if (node.type === 'string') {
      parsersCount = 1; // parser base
    }

    discoveries.push({
      nodeId: node.id,
      parsersCount
    });

    // Ricorsione sui subnodi
    if (node.subNodes && node.subNodes.length > 0) {
      node.subNodes.forEach(analyzeNode);
    }
  };

  schema.forEach(analyzeNode);
  return discoveries;
}
