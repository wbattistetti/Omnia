/**
 * Structural orchestration: deterministic graph → variable store → subflow wiring.
 */

export * from './commands';
export * from './StructuralOrchestrator';
export * from './reconcileVariableStore';
export * from './hydrateTaskVariables';
export * from './compileTranslationsForAffected';
export * from './syncSubflowInterfaceAndBindings';
export * from './invariantChecks';
export * from './planGraphMutation';
export * from './affectedTasks';
