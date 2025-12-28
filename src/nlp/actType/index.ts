export * from './types';
export { getRuleSet, initializeRegistry } from './registry';
export { classify as inferActType } from './classify';

// ❌ ELIMINATO: heuristicToInternal - non serve più, usiamo TaskType direttamente
// ✅ L'euristica ora ritorna TaskType enum direttamente


