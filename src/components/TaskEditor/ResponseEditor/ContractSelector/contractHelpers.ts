/**
 * Contract Helpers
 * Utilities for loading and saving NLP contracts
 * Simplified: assumes new format (no legacy migration)
 */

import type { NLPContract } from '../../../../components/DialogueDataEngine/contracts/contractLoader';

/**
 * Load contract from node (assumes new format with methods structure)
 */
export function loadContractFromNode(node: any): NLPContract | null {
  if (!node?.nlpContract) {
    return null;
  }

  return node.nlpContract as NLPContract;
}

/**
 * Save contract to node
 */
export function saveContractToNode(node: any, contract: NLPContract | null): void {
  if (!node) return;

  if (contract) {
    node.nlpContract = contract;
  } else {
    delete node.nlpContract;
  }
}
