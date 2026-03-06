/**
 * FlowStateBridge - Centralized accessor for flow state
 *
 * PHASE 4: This bridge provides a single point of access to flow data,
 * currently backed by window globals. In future phases, this can be
 * swapped to use a proper state management solution (Zustand, Redux, etc.)
 * without changing consumers.
 *
 * Benefits:
 * - Single source of truth for where flow data comes from
 * - Easy to refactor later (change implementation, not consumers)
 * - Type-safe access to flow data
 * - Logging/debugging in one place
 */

import type { Node, Edge } from 'reactflow';
import type { FlowNode, EdgeData } from '../components/Flowchart/types/flowTypes';

// Type for the window globals (for documentation and type safety)
interface FlowWindowGlobals {
  __flowNodes?: Node<FlowNode>[];
  __flowEdges?: Edge<EdgeData>[];
  __flowTasks?: any[];
  __flows?: Record<string, { nodes: Node<FlowNode>[]; edges: Edge<EdgeData>[] }>;
  __flowDragMode?: 'rigid' | null | undefined;
  __flowLastTemp?: string | null;
  __flowOnMessage?: ((msg: any) => void) | null;
}

// Type assertion for window
declare global {
  interface Window extends FlowWindowGlobals {}
}

/**
 * FlowStateBridge singleton
 * Provides centralized access to flow state
 */
class FlowStateBridgeClass {
  private static instance: FlowStateBridgeClass;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): FlowStateBridgeClass {
    if (!FlowStateBridgeClass.instance) {
      FlowStateBridgeClass.instance = new FlowStateBridgeClass();
    }
    return FlowStateBridgeClass.instance;
  }

  // ========== GETTERS ==========

  /**
   * Get current flow nodes
   */
  getNodes(): Node<FlowNode>[] {
    if (typeof window === 'undefined') return [];
    return (window as any).__flowNodes || [];
  }

  /**
   * Get current flow edges
   */
  getEdges(): Edge<EdgeData>[] {
    if (typeof window === 'undefined') return [];
    return (window as any).__flowEdges || [];
  }

  /**
   * Get current flow tasks
   */
  getTasks(): any[] {
    if (typeof window === 'undefined') return [];
    return (window as any).__flowTasks || [];
  }

  /**
   * Get all flow data at once
   */
  getFlowData(): { nodes: Node<FlowNode>[]; edges: Edge<EdgeData>[]; tasks: any[] } {
    return {
      nodes: this.getNodes(),
      edges: this.getEdges(),
      tasks: this.getTasks(),
    };
  }

  /**
   * Get a specific flow by ID
   */
  getFlowById(flowId: string): { nodes: Node<FlowNode>[]; edges: Edge<EdgeData>[] } | null {
    if (typeof window === 'undefined') return null;
    const flows = (window as any).__flows;
    if (flows && flows[flowId]) {
      return flows[flowId];
    }
    return null;
  }

  /**
   * Check if flow has nodes
   */
  hasNodes(): boolean {
    const nodes = this.getNodes();
    return nodes.length > 0;
  }

  /**
   * Check if flow is empty
   */
  isEmpty(): boolean {
    return !this.hasNodes();
  }

  /**
   * Find a node by ID
   */
  findNode(nodeId: string): Node<FlowNode> | undefined {
    return this.getNodes().find(n => n.id === nodeId);
  }

  /**
   * Find an edge by ID
   */
  findEdge(edgeId: string): Edge<EdgeData> | undefined {
    return this.getEdges().find(e => e.id === edgeId);
  }

  // ========== SETTERS ==========

  /**
   * Set flow nodes (for backward compatibility)
   */
  setNodes(nodes: Node<FlowNode>[]): void {
    if (typeof window === 'undefined') return;
    try {
      (window as any).__flowNodes = nodes;
    } catch (e) {
      console.warn('[FlowStateBridge] Failed to set nodes:', e);
    }
  }

  /**
   * Set flow edges (for backward compatibility)
   */
  setEdges(edges: Edge<EdgeData>[]): void {
    if (typeof window === 'undefined') return;
    try {
      (window as any).__flowEdges = edges;
    } catch (e) {
      console.warn('[FlowStateBridge] Failed to set edges:', e);
    }
  }

  /**
   * Set flow tasks
   */
  setTasks(tasks: any[]): void {
    if (typeof window === 'undefined') return;
    try {
      (window as any).__flowTasks = tasks;
    } catch (e) {
      console.warn('[FlowStateBridge] Failed to set tasks:', e);
    }
  }

  /**
   * Store a flow by ID
   */
  storeFlow(flowId: string, nodes: Node<FlowNode>[], edges: Edge<EdgeData>[]): void {
    if (typeof window === 'undefined') return;
    try {
      (window as any).__flows = (window as any).__flows || {};
      (window as any).__flows[flowId] = { nodes, edges };
    } catch (e) {
      console.warn('[FlowStateBridge] Failed to store flow:', e);
    }
  }

  // ========== DRAG MODE ==========

  getDragMode(): 'rigid' | null | undefined {
    if (typeof window === 'undefined') return null;
    return (window as any).__flowDragMode;
  }

  setDragMode(mode: 'rigid' | null | undefined): void {
    if (typeof window === 'undefined') return;
    try {
      (window as any).__flowDragMode = mode;
    } catch (e) {
      // Silent fail for drag mode
    }
  }

  isRigidDrag(): boolean {
    return this.getDragMode() === 'rigid';
  }

  // ========== UTILITIES ==========

  /**
   * Clear all flow data
   */
  clear(): void {
    if (typeof window === 'undefined') return;
    try {
      (window as any).__flowNodes = [];
      (window as any).__flowEdges = [];
      (window as any).__flowTasks = [];
    } catch (e) {
      console.warn('[FlowStateBridge] Failed to clear flow data:', e);
    }
  }

  /**
   * Debug: Log current state
   */
  debug(): void {
    console.log('[FlowStateBridge] Current state:', {
      nodesCount: this.getNodes().length,
      edgesCount: this.getEdges().length,
      tasksCount: this.getTasks().length,
      dragMode: this.getDragMode(),
    });
  }
}

// Export singleton instance
export const FlowStateBridge = FlowStateBridgeClass.getInstance();

// Export convenience hook for React components
import { useMemo } from 'react';

/**
 * Hook to access FlowStateBridge in React components
 * Returns memoized accessor functions
 */
export function useFlowStateBridge() {
  return useMemo(() => ({
    getNodes: () => FlowStateBridge.getNodes(),
    getEdges: () => FlowStateBridge.getEdges(),
    getTasks: () => FlowStateBridge.getTasks(),
    getFlowData: () => FlowStateBridge.getFlowData(),
    findNode: (id: string) => FlowStateBridge.findNode(id),
    findEdge: (id: string) => FlowStateBridge.findEdge(id),
    hasNodes: () => FlowStateBridge.hasNodes(),
    isEmpty: () => FlowStateBridge.isEmpty(),
    isRigidDrag: () => FlowStateBridge.isRigidDrag(),
  }), []);
}
