import { useCallback } from 'react';
import { Node } from 'reactflow';
import type { FlowNode } from '../types/flowTypes';

const NODE_WIDTH = 280; // Standard node width

const getNodeHeight = (node: Node<FlowNode>): number => {
  const baseHeight = 40;
  const rowHeight = 24;
  const padding = 20;
  const rows = (node.data as any)?.rows || [];
  return baseHeight + (rows.length * rowHeight) + padding;
};

export function useNodeAlignment(
  nodes: Node<FlowNode>[],
  setNodes: React.Dispatch<React.SetStateAction<Node<FlowNode>[]>>,
  setSelectionMenu: (menu: { show: boolean; x: number; y: number }) => void
) {
  const handleAlign = useCallback((type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom', selectedNodeIds: string[]) => {
    if (selectedNodeIds.length < 2) return;

    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    if (selectedNodes.length < 2) return;

    setNodes(nds => {
      const updated = [...nds];

      if (type === 'left' || type === 'center' || type === 'right') {
        // Horizontal alignment
        const minX = Math.min(...selectedNodes.map(n => n.position.x));
        const maxX = Math.max(...selectedNodes.map(n => n.position.x + NODE_WIDTH));
        const centerX = (minX + maxX) / 2;

        selectedNodes.forEach(node => {
          const idx = updated.findIndex(n => n.id === node.id);
          if (idx === -1) return;

          let newX = node.position.x;
          if (type === 'left') newX = minX;
          else if (type === 'center') newX = centerX - (NODE_WIDTH / 2);
          else if (type === 'right') newX = maxX - NODE_WIDTH;

          updated[idx] = { ...updated[idx], position: { ...updated[idx].position, x: newX } };
        });
      } else {
        // Vertical alignment
        const minY = Math.min(...selectedNodes.map(n => n.position.y));
        const maxY = Math.max(...selectedNodes.map(n => n.position.y + getNodeHeight(n)));
        const centerY = (minY + maxY) / 2;

        selectedNodes.forEach(node => {
          const idx = updated.findIndex(n => n.id === node.id);
          if (idx === -1) return;

          let newY = node.position.y;
          if (type === 'top') newY = minY;
          else if (type === 'middle') newY = centerY - (getNodeHeight(node) / 2);
          else if (type === 'bottom') newY = maxY - getNodeHeight(node);

          updated[idx] = { ...updated[idx], position: { ...updated[idx].position, y: newY } };
        });
      }

      return updated;
    });

    setSelectionMenu({ show: false, x: 0, y: 0 });
  }, [nodes, setNodes, setSelectionMenu]);

  const handleDistribute = useCallback((type: 'horizontal' | 'vertical', selectedNodeIds: string[]) => {
    if (selectedNodeIds.length < 3) return;

    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    if (selectedNodes.length < 3) return;

    setNodes(nds => {
      const updated = [...nds];

      // Sort nodes by position
      const sorted = [...selectedNodes].sort((a, b) => {
        if (type === 'horizontal') {
          return a.position.x - b.position.x;
        } else {
          return a.position.y - b.position.y;
        }
      });

      if (type === 'horizontal') {
        const minX = sorted[0].position.x;
        const maxX = sorted[sorted.length - 1].position.x + NODE_WIDTH;
        const totalSpan = maxX - minX;
        const totalNodeSize = sorted.reduce((sum, n) => sum + NODE_WIDTH, 0);
        const gapSize = (totalSpan - totalNodeSize) / (sorted.length - 1);

        let currentX = minX;
        sorted.forEach((node) => {
          const nodeIdx = updated.findIndex(n => n.id === node.id);
          if (nodeIdx === -1) return;

          updated[nodeIdx] = {
            ...updated[nodeIdx],
            position: { ...updated[nodeIdx].position, x: currentX }
          };
          currentX += NODE_WIDTH + gapSize;
        });
      } else {
        const minY = sorted[0].position.y;
        const maxY = sorted[sorted.length - 1].position.y + getNodeHeight(sorted[sorted.length - 1]);
        const totalSpan = maxY - minY;
        const totalNodeSize = sorted.reduce((sum, n) => sum + getNodeHeight(n), 0);
        const gapSize = (totalSpan - totalNodeSize) / (sorted.length - 1);

        let currentY = minY;
        sorted.forEach((node) => {
          const nodeIdx = updated.findIndex(n => n.id === node.id);
          if (nodeIdx === -1) return;

          const nodeHeight = getNodeHeight(node);
          updated[nodeIdx] = {
            ...updated[nodeIdx],
            position: { ...updated[nodeIdx].position, y: currentY }
          };
          currentY += nodeHeight + gapSize;
        });
      }

      return updated;
    });

    setSelectionMenu({ show: false, x: 0, y: 0 });
  }, [nodes, setNodes, setSelectionMenu]);

  // Check if alignment would cause overlaps
  const checkAlignmentOverlap = useCallback((type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom', selectedNodeIds: string[]): boolean => {
    if (selectedNodeIds.length < 2) return false;

    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    if (selectedNodes.length < 2) return false;

    // Calculate new positions after alignment
    const newPositions = new Map<string, { x: number; y: number }>();

    if (type === 'left' || type === 'center' || type === 'right') {
      // Horizontal alignment
      const minX = Math.min(...selectedNodes.map(n => n.position.x));
      const maxX = Math.max(...selectedNodes.map(n => n.position.x + NODE_WIDTH));
      const centerX = (minX + maxX) / 2;

      selectedNodes.forEach(node => {
        let newX = node.position.x;
        if (type === 'left') newX = minX;
        else if (type === 'center') newX = centerX - (NODE_WIDTH / 2);
        else if (type === 'right') newX = maxX - NODE_WIDTH;
        newPositions.set(node.id, { x: newX, y: node.position.y });
      });
    } else {
      // Vertical alignment
      const minY = Math.min(...selectedNodes.map(n => n.position.y));
      const maxY = Math.max(...selectedNodes.map(n => n.position.y + getNodeHeight(n)));
      const centerY = (minY + maxY) / 2;

      selectedNodes.forEach(node => {
        let newY = node.position.y;
        if (type === 'top') newY = minY;
        else if (type === 'middle') newY = centerY - (getNodeHeight(node) / 2);
        else if (type === 'bottom') newY = maxY - getNodeHeight(node);
        newPositions.set(node.id, { x: node.position.x, y: newY });
      });
    }

    // Check for overlaps
    const nodeArray = Array.from(newPositions.entries());
    for (let i = 0; i < nodeArray.length; i++) {
      const [id1, pos1] = nodeArray[i];
      const node1 = selectedNodes.find(n => n.id === id1)!;
      const h1 = getNodeHeight(node1);

      for (let j = i + 1; j < nodeArray.length; j++) {
        const [id2, pos2] = nodeArray[j];
        const node2 = selectedNodes.find(n => n.id === id2)!;
        const h2 = getNodeHeight(node2);

        // Check if rectangles overlap
        const overlapX = !(pos1.x + NODE_WIDTH <= pos2.x || pos2.x + NODE_WIDTH <= pos1.x);
        const overlapY = !(pos1.y + h1 <= pos2.y || pos2.y + h2 <= pos1.y);

        if (overlapX && overlapY) {
          return true; // Overlap detected
        }
      }
    }

    return false;
  }, [nodes]);

  // Check if distribution would cause overlaps
  const checkDistributionOverlap = useCallback((type: 'horizontal' | 'vertical', selectedNodeIds: string[]): boolean => {
    if (selectedNodeIds.length < 3) return false; // Need at least 3 nodes to distribute

    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    if (selectedNodes.length < 3) return false;

    // Sort nodes by position
    const sorted = [...selectedNodes].sort((a, b) => {
      if (type === 'horizontal') {
        return a.position.x - b.position.x;
      } else {
        return a.position.y - b.position.y;
      }
    });

    // Calculate total span and gaps
    let totalSpan = 0;
    let totalNodeSize = 0;

    if (type === 'horizontal') {
      const minX = sorted[0].position.x;
      const maxX = sorted[sorted.length - 1].position.x + NODE_WIDTH;
      totalSpan = maxX - minX;
      totalNodeSize = sorted.reduce((sum, n) => sum + NODE_WIDTH, 0);
    } else {
      const minY = sorted[0].position.y;
      const maxY = sorted[sorted.length - 1].position.y + getNodeHeight(sorted[sorted.length - 1]);
      totalSpan = maxY - minY;
      totalNodeSize = sorted.reduce((sum, n) => sum + getNodeHeight(n), 0);
    }

    const gapSize = (totalSpan - totalNodeSize) / (sorted.length - 1);

    // If gap is too small (negative or very small), nodes would overlap
    return gapSize < 10; // 10px minimum gap
  }, [nodes]);

  return {
    handleAlign,
    handleDistribute,
    checkAlignmentOverlap,
    checkDistributionOverlap
  };
}


