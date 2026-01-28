import type { AssembledDDT } from '../../../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';

/**
 * Helper to find the original node from currentDDT by label/id
 * Used by other components that need to access the original DDT structure
 */
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
    if (Array.isArray(main.subTasks)) {
      for (const sub of main.subTasks) {
        if ((nodeLabel && sub.label === nodeLabel) || (nodeId && sub.id === nodeId)) {
          return sub;
        }
      }
    }
  }
  return undefined;
}
