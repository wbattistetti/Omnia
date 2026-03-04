/**
 * Helper functions for flow testing
 *
 * These utilities support testing individual nodes by creating minimal flows
 * that reuse the same compilation and execution infrastructure.
 */

/**
 * Creates a single-node flow from a node ID
 * This is equivalent to creating a TaskGroup for just that node
 *
 * @param nodeId - ID of the node to test
 * @param allNodes - All nodes in the flow
 * @param allEdges - All edges in the flow (not used for single node)
 * @param allTasks - All tasks (needed as they might be referenced)
 * @returns Flow data with only the selected node
 */
export function createSingleNodeFlow(
  nodeId: string,
  allNodes: any[],
  allEdges: any[],
  allTasks: any[]
): { nodes: any[]; edges: any[]; tasks: any[] } {
  const node = allNodes.find(n => n.id === nodeId);
  if (!node) {
    throw new Error(`Node ${nodeId} not found in flow`);
  }

  return {
    nodes: [node],
    edges: [], // No edges for single node test (no entry conditions)
    tasks: allTasks, // All tasks might be referenced by the node
  };
}
