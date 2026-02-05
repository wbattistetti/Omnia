// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Get nodes from TaskTree/AssembledTaskTree
 * Phase 4A: nodes is now required, no fallback to data
 *
 * @param taskTree - TaskTree or AssembledTaskTree object
 * @param context - Context string for logging (e.g., 'ddtEngine.getNextData')
 * @returns Array of nodes (only from nodes, no fallback)
 */
export function getNodesWithFallback(
  taskTree: any,
  context: string = 'unknown'
): any[] {
  if (!taskTree) return [];

  // ✅ Phase 4A: Only use nodes (no fallback to data)
  if (Array.isArray(taskTree.nodes)) {
    return taskTree.nodes.filter(Boolean);
  }

  // ❌ Phase 4A: No fallback - if data exists but no nodes, log error and return empty
  if (Array.isArray(taskTree.data)) {
    console.error(
      `[MIGRATION ERROR] ${context} has 'data' property but no 'nodes'. TaskTree must have 'nodes'. ` +
      `The source must be updated to produce 'nodes' instead of 'data'.`,
      {
        context,
        taskTreeId: taskTree.id || taskTree._id,
        hasNodes: false,
        hasData: true,
        dataLength: taskTree.data.length,
        availableKeys: Object.keys(taskTree),
        stack: new Error().stack?.split('\n').slice(1, 6).join('\n')
      }
    );

    // ✅ Track usage for metrics (still track for monitoring)
    if (typeof window !== 'undefined') {
      const metrics = (window as any).__migrationMetrics || {};
      metrics.dataFallbackCount = (metrics.dataFallbackCount || 0) + 1;
      metrics.dataFallbackContexts = metrics.dataFallbackContexts || [];
      if (!metrics.dataFallbackContexts.includes(context)) {
        metrics.dataFallbackContexts.push(context);
      }
      (window as any).__migrationMetrics = metrics;
    }

    // ❌ Phase 4A: Return empty array instead of data (no fallback)
    return [];
  }

  // ✅ No nodes and no data - return empty array
  return [];
}

/**
 * Get migration metrics for monitoring
 */
export function getMigrationMetrics(): {
  dataFallbackCount: number;
  dataFallbackContexts: string[];
  migrationComplete: boolean;
} {
  if (typeof window === 'undefined') {
    return { dataFallbackCount: 0, dataFallbackContexts: [], migrationComplete: true };
  }

  const metrics = (window as any).__migrationMetrics || {};
  return {
    dataFallbackCount: metrics.dataFallbackCount || 0,
    dataFallbackContexts: metrics.dataFallbackContexts || [],
    migrationComplete: (metrics.dataFallbackCount || 0) === 0
  };
}

/**
 * Reset migration metrics (for testing)
 */
export function resetMigrationMetrics(): void {
  if (typeof window !== 'undefined') {
    (window as any).__migrationMetrics = {
      dataFallbackCount: 0,
      dataFallbackContexts: []
    };
  }
}
