// Dialogue Engine (Orchestrator) - Backend Runtime
// Main entry point for DialogueEngine

export { DialogueEngine } from './engine';
export { evaluateCondition, setProjectData, getProjectData } from './conditionEvaluator';
export type { Condition, ExecutionState, RetrievalState } from '../compiler/types';



