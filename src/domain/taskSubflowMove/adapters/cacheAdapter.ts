/**
 * Child-flow interface cache invalidation port (delegates to childFlowInterfaceService).
 */

import { invalidateChildFlowInterfaceCache } from '@services/childFlowInterfaceService';

export type CacheAdapter = {
  invalidateChildInterface(projectId: string, childFlowId: string): void;
};

export function createDefaultCacheAdapter(): CacheAdapter {
  return {
    invalidateChildInterface: (projectId, childFlowId) =>
      invalidateChildFlowInterfaceCache(projectId, childFlowId),
  };
}
