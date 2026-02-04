// DDT Event Handling

import type { RetrieveEvent, DDTNavigatorCallbacks } from './ddtTypes';
import type { AssembledTaskTree } from '../../TaskTreeBuilder/DDTAssembler/currentDDT.types';

/**
 * Gets retrieve event from system
 * This can be synchronous (evaluate state) or asynchronous (wait for user input)
 */
export async function getRetrieveEvent(
  nodeId: string,
  onGetRetrieveEvent?: (nodeId: string, ddt?: AssembledTaskTree) => Promise<RetrieveEvent>,
  ddt?: AssembledTaskTree
): Promise<RetrieveEvent> {
  // If callback provided, use it (async - waits for user input)
  if (onGetRetrieveEvent) {
    return await onGetRetrieveEvent(nodeId, ddt);
  }

  // Default: return noMatch (should be overridden by actual implementation)
  return { type: 'noMatch' };
}

/**
 * Handles exit action
 */
export function handleExitAction(exitAction: any): { exit: boolean; exitAction: any } {
  return {
    exit: true,
    exitAction
  };
}

