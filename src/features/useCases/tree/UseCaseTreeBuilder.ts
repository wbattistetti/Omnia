import type { UseCase } from '../model';
import { buildUseCaseTree, type UseCaseTreeNode } from './useCaseTreeModel';

/**
 * Builder module for use-case dot-name tree.
 */
export function buildUseCaseTreeFromList(useCases: readonly UseCase[]): UseCaseTreeNode[] {
  return buildUseCaseTree(useCases);
}

