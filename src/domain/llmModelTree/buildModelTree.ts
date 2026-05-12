/**
 * Pure transformer: flat `[{ id, label, provider }]` -> hierarchical model tree.
 *
 * Model ids are treated as structured paths. Separators `-`, `:` and `/` create one tree level
 * each, except ISO-like dates (`YYYY-MM-DD` and `YYYY-MM-DD-HH-MM-SS`) which remain a single
 * atomic segment. Examples:
 *
 *   gpt-4o-mini-audio-preview-2024-12-17
 *   -> gpt / 4o / mini / audio / preview / 2024-12-17
 *
 *   openai/gpt-oss-120b
 *   -> openai / gpt / oss / 120b
 *
 * A node can be both a branch and a real selectable model (for example `gpt-4o` has children like
 * `gpt-4o-mini`, but the base model is selectable too). The canonical model id is stored in
 * `selectableModelId` and is always forwarded unchanged to the caller/provider.
 */

import type { AvailableLlmModelOption } from '@hooks/useAvailableLlmModels';
import type { LlmCatalogProviderId } from '@services/iaCatalogApi';

const DATE_PART_RE = /^\d{4}$/;
const TWO_DIGIT_RE = /^\d{2}$/;

export interface ModelTreeNode {
  kind: 'node';
  /** Stable path from provider root to this node, lowercased for persistence/filtering. */
  nodeKey: string;
  /** Clean text shown in the row. */
  label: string;
  providerId: LlmCatalogProviderId;
  children: ModelTreeNode[];
  /** Present when this path also corresponds to a real model id. */
  selectableModelId?: string;
  /** Number of selectable models in this subtree, including this node if selectable. */
  modelCount: number;
}

export interface ModelTreeProvider {
  kind: 'provider';
  providerId: LlmCatalogProviderId;
  label: string;
  children: ModelTreeNode[];
  /** Sum of selectable models across the subtree, used in the row counter. */
  modelCount: number;
}

export interface ProviderSpec {
  id: LlmCatalogProviderId;
  label: string;
}

export interface BuildModelTreeOptions {
  /** Stable provider order (matches `OmniaTutorSetup` `TUTOR_PROVIDERS`). */
  providers: ReadonlyArray<ProviderSpec>;
}

function appendDashSegments(out: string[], value: string): void {
  const parts = value.split('-').filter(Boolean);
  for (let i = 0; i < parts.length; i += 1) {
    const current = parts[i];
    const isDate =
      DATE_PART_RE.test(current) &&
      TWO_DIGIT_RE.test(parts[i + 1] ?? '') &&
      TWO_DIGIT_RE.test(parts[i + 2] ?? '');
    if (!isDate) {
      out.push(current);
      continue;
    }
    const hasTime =
      TWO_DIGIT_RE.test(parts[i + 3] ?? '') &&
      TWO_DIGIT_RE.test(parts[i + 4] ?? '') &&
      TWO_DIGIT_RE.test(parts[i + 5] ?? '');
    const size = hasTime ? 6 : 3;
    out.push(parts.slice(i, i + size).join('-'));
    i += size - 1;
  }
}

/** Split a model id into hierarchy segments, preserving dates as a single segment. */
export function splitModelIdIntoSegments(modelId: string): string[] {
  const segments: string[] = [];
  for (const part of modelId.trim().split(/[:/]/).filter(Boolean)) {
    appendDashSegments(segments, part);
  }
  return segments.length > 0 ? segments : ['other'];
}

function compareByText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

function createNode(providerId: LlmCatalogProviderId, nodeKey: string, label: string): ModelTreeNode {
  return {
    kind: 'node',
    nodeKey,
    label,
    providerId,
    children: [],
    modelCount: 0,
  };
}

function countSelectableModels(node: ModelTreeNode): number {
  node.children.sort((a, b) => compareByText(a.label, b.label));
  node.modelCount =
    (node.selectableModelId ? 1 : 0) + node.children.reduce((sum, child) => sum + countSelectableModels(child), 0);
  return node.modelCount;
}

/**
 * Build the provider -> model path tree. Empty providers (no models) are kept so the user
 * sees them collapsed and understands the catalog is empty for that backend.
 */
export function buildModelTree(
  options: ReadonlyArray<AvailableLlmModelOption>,
  config: BuildModelTreeOptions
): ModelTreeProvider[] {
  const providersById = new Map<LlmCatalogProviderId, ModelTreeProvider>();
  for (const spec of config.providers) {
    providersById.set(spec.id, {
      kind: 'provider',
      providerId: spec.id,
      label: spec.label,
      children: [],
      modelCount: 0,
    });
  }

  for (const option of options) {
    const providerNode = providersById.get(option.provider);
    if (!providerNode) continue;
    const segments = splitModelIdIntoSegments(option.id);
    let siblings = providerNode.children;
    let current: ModelTreeNode | null = null;
    let path = '';
    for (const segment of segments) {
      path = path ? `${path}/${segment.toLowerCase()}` : segment.toLowerCase();
      let node = siblings.find((candidate) => candidate.nodeKey === path);
      if (!node) {
        node = createNode(option.provider, path, segment);
        siblings.push(node);
      }
      current = node;
      siblings = node.children;
    }
    if (current) {
      current.selectableModelId = option.id;
    }
  }

  for (const providerNode of providersById.values()) {
    providerNode.children.sort((a, b) => compareByText(a.label, b.label));
    providerNode.modelCount = providerNode.children.reduce(
      (sum, child) => sum + countSelectableModels(child),
      0
    );
  }

  return config.providers
    .map((p) => providersById.get(p.id))
    .filter((node): node is ModelTreeProvider => node !== undefined);
}

/**
 * Find the node matching a stored model id (used to highlight the current selection and to
 * auto-expand its ancestors on first render).
 */
export function findLeafByModelId(
  tree: ReadonlyArray<ModelTreeProvider>,
  modelId: string | null | undefined
): { provider: ModelTreeProvider; node: ModelTreeNode; ancestors: ModelTreeNode[] } | null {
  if (!modelId) return null;
  for (const provider of tree) {
    const hit = findNodeByModelId(provider.children, modelId, []);
    if (hit) {
      return { provider, node: hit.node, ancestors: hit.ancestors };
    }
  }
  return null;
}

function findNodeByModelId(
  nodes: ReadonlyArray<ModelTreeNode>,
  modelId: string,
  ancestors: ModelTreeNode[]
): { node: ModelTreeNode; ancestors: ModelTreeNode[] } | null {
  for (const node of nodes) {
    if (node.selectableModelId === modelId) return { node, ancestors };
    const hit = findNodeByModelId(node.children, modelId, [...ancestors, node]);
    if (hit) return hit;
  }
  return null;
}

/**
 * Filter the tree against a search query. Matching is case-insensitive on either the selectable
 * `modelId`, the node label, or the provider label. Empty branches are pruned so collapsed-by-default
 * UX still surfaces results.
 */
export function filterModelTree(
  tree: ReadonlyArray<ModelTreeProvider>,
  query: string
): ModelTreeProvider[] {
  const q = query.trim().toLowerCase();
  if (!q) return tree.slice();
  const out: ModelTreeProvider[] = [];
  for (const provider of tree) {
    const providerMatches = provider.label.toLowerCase().includes(q);
    const children = filterNodes(provider.children, q, providerMatches);
    const modelCount = children.reduce((sum, child) => sum + child.modelCount, 0);
    if (children.length === 0 && !providerMatches) continue;
    out.push({ ...provider, children, modelCount });
  }
  return out;
}

function filterNodes(
  nodes: ReadonlyArray<ModelTreeNode>,
  query: string,
  ancestorMatches: boolean
): ModelTreeNode[] {
  const out: ModelTreeNode[] = [];
  for (const node of nodes) {
    const selfMatches =
      ancestorMatches ||
      node.label.toLowerCase().includes(query) ||
      (node.selectableModelId?.toLowerCase().includes(query) ?? false);
    const children = filterNodes(node.children, query, selfMatches);
    const include = selfMatches || children.length > 0;
    if (!include) continue;
    const modelCount = (node.selectableModelId ? 1 : 0) + children.reduce((sum, child) => sum + child.modelCount, 0);
    out.push({ ...node, children, modelCount });
  }
  return out;
}
