import type { UseCase } from '../model';

/**
 * Tree node used by UI for dot-name navigation.
 */
export type UseCaseTreeNode = {
  id: string;
  name: string;
  fullPath: string;
  kind: 'segment';
  parentPath: string;
  useCaseId?: string;
  children: UseCaseTreeNode[];
};

/**
 * Builds a deterministic folder/use-case tree from dot-name keys.
 */
export function buildUseCaseTree(useCases: readonly UseCase[]): UseCaseTreeNode[] {
  const roots: UseCaseTreeNode[] = [];
  const byPath = new Map<string, UseCaseTreeNode>();

  const ensureSegment = (parentPath: string, name: string): UseCaseTreeNode => {
    const fullPath = parentPath ? `${parentPath}.${name}` : name;
    const cached = byPath.get(fullPath);
    if (cached) return cached;
    const created: UseCaseTreeNode = {
      id: `segment:${fullPath}`,
      name,
      fullPath,
      parentPath,
      kind: 'segment',
      children: [],
    };
    byPath.set(fullPath, created);
    if (parentPath) {
      const parent = byPath.get(parentPath);
      if (!parent) {
        throw new Error(`buildUseCaseTree: missing parent segment ${parentPath}.`);
      }
      parent.children.push(created);
    } else {
      roots.push(created);
    }
    return created;
  };

  for (const uc of useCases) {
    const key = String(uc.key || '').trim();
    if (!key) continue;
    const parts = key.split('.').filter(Boolean);
    if (parts.length === 0) continue;

    let parentPath = '';
    for (let i = 0; i < parts.length; i += 1) {
      const node = ensureSegment(parentPath, parts[i]);
      parentPath = node.fullPath;
      if (i === parts.length - 1) {
        node.useCaseId = uc.id;
      }
    }
  }

  const sortNodes = (nodes: UseCaseTreeNode[]): UseCaseTreeNode[] =>
    [...nodes]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((n) => ({
        ...n,
        children: sortNodes(n.children),
      }));

  return sortNodes(roots);
}

/**
 * Renames one folder segment and recursively updates all matching use case keys.
 */
export function renameFolderPrefix(
  useCases: readonly UseCase[],
  oldPrefix: string,
  newSegment: string
): UseCase[] {
  const oldP = String(oldPrefix || '').trim();
  const seg = String(newSegment || '').trim();
  if (!oldP || !seg) {
    throw new Error('renameFolderPrefix: oldPrefix and newSegment are required.');
  }
  const parts = oldP.split('.');
  parts[parts.length - 1] = seg;
  const nextPrefix = parts.join('.');
  const oldStart = `${oldP}.`;
  return useCases.map((uc) => {
    if (uc.key === oldP) {
      return withUseCaseKey(uc, nextPrefix);
    }
    if (uc.key.startsWith(oldStart)) {
      return withUseCaseKey(uc, `${nextPrefix}.${uc.key.slice(oldStart.length)}`);
    }
    return uc;
  });
}

/**
 * Moves one use case key to a new folder path.
 */
export function moveUseCaseKeyToFolder(useCase: UseCase, targetFolderPath: string): UseCase {
  const folder = String(targetFolderPath || '').trim();
  const current = String(useCase.key || '').trim();
  if (!current) {
    throw new Error('moveUseCaseKeyToFolder: useCase.key is required.');
  }
  const leaf = current.split('.').filter(Boolean).slice(-1)[0] || current;
  const nextKey = folder ? `${folder}.${leaf}` : leaf;
  return withUseCaseKey(useCase, nextKey);
}

/**
 * Returns true if a subtree contains at least one use case.
 */
export function subtreeHasUseCase(node: UseCaseTreeNode): boolean {
  if (node.useCaseId) return true;
  return node.children.some((c) => subtreeHasUseCase(c));
}

/**
 * Returns a use case copy with updated key and label key.
 */
export function withUseCaseKey(useCase: UseCase, key: string): UseCase {
  const nextKey = String(key || '').trim();
  if (!nextKey) {
    throw new Error('withUseCaseKey: key is required.');
  }
  return {
    ...useCase,
    key: nextKey,
    label: `Usecase:${nextKey}`,
  };
}

