import { TreeNodeProps } from '@responseEditor/types';

// Default nodes for testing/initialization
export const defaultNodes: TreeNodeProps[] = [
  { id: '1', text: "What is the patient's date of birth?", type: 'root' },
  { id: '2', text: "I didn't understand. Could you provide the patient's date of birth?", type: 'nomatch', level: 1, parentId: '1' },
  { id: '3', text: "Please provide the patient's date of birth.", type: 'noinput', level: 1, parentId: '1' }
];

// Constants for escalation calculations
export const ESCALATION_CONSTANTS = {
  HEADER_HEIGHT: 40,
  PADDING: 8,
  ACTION_HEIGHT: 32,
  DROP_TOLERANCE: 16
} as const;

/**
 * Calculate the closest node index based on mouse position
 */
export const findClosestNodeIndex = (
  nodes: TreeNodeProps[],
  y: number,
  containerRect: DOMRect
): { closestIdx: number; minY: number; maxY: number } => {
  let closestIdx = -1;
  let minDist = Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  nodes.forEach((node, idx) => {
    const nodeElem = document.getElementById('tree-node-' + node.id);
    if (nodeElem) {
      const rect = nodeElem.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2 - containerRect.top;
      if (centerY < minY) minY = centerY;
      if (centerY > maxY) maxY = centerY;
      const dist = Math.abs(centerY - y);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    }
  });

  return { closestIdx, minY, maxY };
};

/**
 * Check if drop position is outside the nodes area
 */
export const isDropOutsideNodes = (
  y: number,
  minY: number,
  maxY: number,
  tolerance: number = ESCALATION_CONSTANTS.DROP_TOLERANCE
): boolean => {
  return y < minY - tolerance || y > maxY + tolerance;
};

/**
 * Calculate drop position (before/after) based on mouse position relative to node center
 */
export const calculateDropPosition = (
  y: number,
  nodeElem: HTMLElement,
  containerRect: DOMRect
): 'before' | 'after' => {
  const rect = nodeElem.getBoundingClientRect();
  const centerY = rect.top + rect.height / 2 - containerRect.top;
  return y < centerY ? 'before' : 'after';
};

/**
 * Check if a node is an escalation node
 */
export const isEscalationNode = (node: TreeNodeProps): boolean => {
  return node.type === 'escalation';
};

/**
 * Get children nodes for an escalation node
 */
export const getEscalationChildren = (
  nodes: TreeNodeProps[],
  parentId: string,
  level: number
): TreeNodeProps[] => {
  return nodes
    .filter(n => n.parentId === parentId)
    .map(child => ({ ...child, level: level + 1 }));
};

/**
 * Calculate escalation label based on position among siblings
 */
export const calculateEscalationLabel = (
  node: TreeNodeProps,
  siblings: TreeNodeProps[]
): string | undefined => {
  if (!isEscalationNode(node)) return undefined;

  const allEscalations = siblings.filter(n => n.type === 'escalation');
  const escIdx = allEscalations.findIndex(n => n.id === node.id);
  return `${escIdx + 1}° recovery`;
};

/**
 * Check if an escalation is single in its step
 */
export const isSingleEscalation = (
  node: TreeNodeProps,
  siblings: TreeNodeProps[],
  stepKey?: string,
  singleEscalationSteps: string[] = ['start', 'success', 'confirmation']
): boolean => {
  if (!isEscalationNode(node) || !stepKey || !singleEscalationSteps.includes(stepKey)) {
    return false;
  }

  const escCount = siblings.filter(n => n.type === 'escalation').length;
  return escCount === 1;
};

/**
 * Validate drop position for escalation nodes
 */
export const validateEscalationDrop = (
  targetNode: TreeNodeProps,
  nodeElem: HTMLElement,
  y: number
): boolean => {
  if (!isEscalationNode(targetNode)) return true;

  const headerHeight = ESCALATION_CONSTANTS.HEADER_HEIGHT;
  const padding = ESCALATION_CONSTANTS.PADDING;
  const nodeTop = nodeElem.offsetTop;
  const nodeHeight = nodeElem.offsetHeight;
  const headerBottom = nodeTop + headerHeight + padding;
  const nodeBottom = nodeTop + nodeHeight;

  // Drop is valid if within the escalation content area
  return y >= headerBottom && y <= nodeBottom;
};

/**
 * Get escalation-specific props for TreeNode
 */
export const getEscalationProps = (
  node: TreeNodeProps,
  childrenNodes: TreeNodeProps[] | undefined,
  escalationLabel: string | undefined,
  isSingleEscalation: boolean,
  extraProps?: { foreColor?: string; bgColor?: string; onToggleInclude?: (id: string) => void }
) => {
  if (!isEscalationNode(node)) return {};

  return {
    childrenNodes,
    escalationLabel,
    included: node.included,
    onToggleInclude: extraProps?.onToggleInclude,
    isSingleEscalation,
    foreColor: extraProps?.foreColor,
    bgColor: extraProps?.bgColor
  };
};