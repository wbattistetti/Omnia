/**
 * Canonical step: invalidate child-flow interface / variable hydration cache after structural move.
 */

import type { CacheAdapter } from '../adapters/cacheAdapter';

export type InvalidateChildInterfaceCacheInput = {
  projectId: string;
  childFlowId: string;
};

export function InvalidateChildInterfaceCache(
  cache: CacheAdapter,
  input: InvalidateChildInterfaceCacheInput
): void {
  cache.invalidateChildInterface(input.projectId, input.childFlowId);
}
