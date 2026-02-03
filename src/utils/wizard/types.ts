// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Generation progress
 */
export interface GenerationProgress {
  currentStep: number;
  totalSteps: number;
  currentNodeId: string;
  currentNodeLabel: string;
  currentAction: string;
  percentage: number;
}
