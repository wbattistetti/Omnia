import type { AssembledDDT } from '../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';

/**
 * ❌ REMOVED: All runtime logic functions (resolveAsk, resolveConfirm, resolveSuccess, resolveEscalation, etc.)
 * These functions were duplicating backend VB.NET logic and have been removed.
 * All message determination, escalation handling, and dialogue state management is now handled by the VB.NET backend.
 *
 * ✅ KEPT: findOriginalNode - Only used for accessing DDT structure (not runtime logic)
 */

// Helper to find the original node from currentDDT by label/id
// This is NOT runtime logic - it's just for accessing the DDT structure
export function findOriginalNode(currentDDT: AssembledDDT, nodeLabel?: string, nodeId?: string): any {
  if (!currentDDT) return undefined;
  const mains = Array.isArray((currentDDT as any)?.data)
    ? (currentDDT as any).data
    : (currentDDT as any)?.data ? [(currentDDT as any).data] : [];

  for (const main of mains) {
    if (!main) continue;
    // Check main node
    if ((nodeLabel && main.label === nodeLabel) || (nodeId && main.id === nodeId)) {
      return main;
    }
    // Check sub nodes
    if (Array.isArray(main.subData)) {
      for (const sub of main.subData) {
        if ((nodeLabel && sub.label === nodeLabel) || (nodeId && sub.id === nodeId)) {
          return sub;
        }
      }
    }
  }
  return undefined;
}
