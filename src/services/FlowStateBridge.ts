/**
 * FlowStateBridge - Centralized accessor for flow state
 *
 * This bridge provides a single point of access to flow data,
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

// Type definitions for callback functions
type SetNodesFunction = (updater: Node<FlowNode>[] | ((nodes: Node<FlowNode>[]) => Node<FlowNode>[])) => void;
type SetEdgesFunction = (updater: Edge<EdgeData>[] | ((edges: Edge<EdgeData>[]) => Edge<EdgeData>[])) => void;
type CreateOnUpdateFunction = (edgeId: string) => (updates: any) => void;
type ScheduleApplyLabelFunction = (edgeId: string, label: string) => void;
type CleanupFunction = () => void;

// Type for the window globals (for documentation and type safety)
interface FlowWindowGlobals {
  // Core flow data
  __flowNodes?: Node<FlowNode>[];
  __flowEdges?: Edge<EdgeData>[];
  __flowTasks?: any[];
  __flows?: Record<string, { nodes: Node<FlowNode>[]; edges: Edge<EdgeData>[] }>;

  // Drag mode
  __flowDragMode?: 'rigid' | null | undefined;
  __flowLastTemp?: string | null;

  // Callback functions (set by FlowEditor)
  __createOnUpdate?: CreateOnUpdateFunction;
  __scheduleApplyLabel?: ScheduleApplyLabelFunction;
  __setEdges?: SetEdgesFunction;
  __setNodes?: SetNodesFunction;
  __cleanupAllTempNodesAndEdges?: CleanupFunction;
  __flowOnMessage?: ((msg: any) => void) | null;

  // Execution state
  __executionState?: any;
  __currentTask?: any;
  __isRunning?: boolean;

  // Connection/interaction state
  __isConnecting?: boolean;
  __dragStartedFromHandle?: boolean;
  __isToolbarDrag?: string | null;  // Node ID being dragged from toolbar
  __blockNodeDrag?: boolean;
  __lastMouseX?: number;
  __lastMouseY?: number;
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

  // ========== CALLBACK FUNCTIONS ==========

  /**
   * Get createOnUpdate function (set by FlowEditor)
   */
  getCreateOnUpdate(): CreateOnUpdateFunction | undefined {
    if (typeof window === 'undefined') return undefined;
    return (window as any).__createOnUpdate;
  }

  /**
   * Set createOnUpdate function
   */
  setCreateOnUpdate(fn: CreateOnUpdateFunction | undefined): void {
    if (typeof window === 'undefined') return;
    (window as any).__createOnUpdate = fn;
  }

  /**
   * Get scheduleApplyLabel function
   */
  getScheduleApplyLabel(): ScheduleApplyLabelFunction | undefined {
    if (typeof window === 'undefined') return undefined;
    return (window as any).__scheduleApplyLabel;
  }

  /**
   * Set scheduleApplyLabel function
   */
  setScheduleApplyLabel(fn: ScheduleApplyLabelFunction | undefined): void {
    if (typeof window === 'undefined') return;
    (window as any).__scheduleApplyLabel = fn;
  }

  /**
   * Get setEdges React setter function
   */
  getSetEdges(): SetEdgesFunction | undefined {
    if (typeof window === 'undefined') return undefined;
    return (window as any).__setEdges;
  }

  /**
   * Set setEdges React setter function
   */
  setSetEdges(fn: SetEdgesFunction | undefined): void {
    if (typeof window === 'undefined') return;
    (window as any).__setEdges = fn;
  }

  /**
   * Get setNodes React setter function
   */
  getSetNodes(): SetNodesFunction | undefined {
    if (typeof window === 'undefined') return undefined;
    return (window as any).__setNodes;
  }

  /**
   * Set setNodes React setter function
   */
  setSetNodes(fn: SetNodesFunction | undefined): void {
    if (typeof window === 'undefined') return;
    (window as any).__setNodes = fn;
  }

  /**
   * Get cleanup function for temporary nodes/edges
   */
  getCleanupAllTempNodesAndEdges(): CleanupFunction | undefined {
    if (typeof window === 'undefined') return undefined;
    return (window as any).__cleanupAllTempNodesAndEdges;
  }

  /**
   * Set cleanup function
   */
  setCleanupAllTempNodesAndEdges(fn: CleanupFunction | undefined): void {
    if (typeof window === 'undefined') return;
    (window as any).__cleanupAllTempNodesAndEdges = fn;
  }

  /**
   * Get flowOnMessage callback
   */
  getFlowOnMessage(): ((msg: any) => void) | null {
    if (typeof window === 'undefined') return null;
    return (window as any).__flowOnMessage || null;
  }

  /**
   * Set flowOnMessage callback
   */
  setFlowOnMessage(fn: ((msg: any) => void) | null): void {
    if (typeof window === 'undefined') return;
    (window as any).__flowOnMessage = fn;
  }

  // ========== EXECUTION STATE ==========

  /**
   * Get current execution state
   */
  getExecutionState(): any {
    if (typeof window === 'undefined') return null;
    return (window as any).__executionState || null;
  }

  /**
   * Set execution state
   */
  setExecutionState(state: any): void {
    if (typeof window === 'undefined') return;
    (window as any).__executionState = state;
  }

  /**
   * Get current task being executed
   */
  getCurrentTask(): any {
    if (typeof window === 'undefined') return null;
    return (window as any).__currentTask || null;
  }

  /**
   * Set current task
   */
  setCurrentTask(task: any): void {
    if (typeof window === 'undefined') return;
    (window as any).__currentTask = task;
  }

  /**
   * Check if flow is running
   */
  isRunning(): boolean {
    if (typeof window === 'undefined') return false;
    return (window as any).__isRunning || false;
  }

  /**
   * Set running state
   */
  setIsRunning(running: boolean): void {
    if (typeof window === 'undefined') return;
    (window as any).__isRunning = running;
  }

  // ========== CONNECTION/INTERACTION STATE ==========

  /**
   * Check if user is currently connecting nodes
   */
  isConnecting(): boolean {
    if (typeof window === 'undefined') return false;
    return (window as any).__isConnecting || false;
  }

  /**
   * Set connecting state
   */
  setIsConnecting(connecting: boolean): void {
    if (typeof window === 'undefined') return;
    (window as any).__isConnecting = connecting;
  }

  /**
   * Check if drag started from a handle
   */
  isDragStartedFromHandle(): boolean {
    if (typeof window === 'undefined') return false;
    return (window as any).__dragStartedFromHandle || false;
  }

  /**
   * Set drag started from handle state
   */
  setDragStartedFromHandle(started: boolean): void {
    if (typeof window === 'undefined') return;
    (window as any).__dragStartedFromHandle = started;
  }

  /**
   * Get the node ID being dragged from toolbar (null if none)
   */
  getToolbarDragNodeId(): string | null {
    if (typeof window === 'undefined') return null;
    return (window as any).__isToolbarDrag || null;
  }

  /**
   * Check if a specific node is being dragged from toolbar
   */
  isToolbarDragForNode(nodeId: string): boolean {
    return this.getToolbarDragNodeId() === nodeId;
  }

  /**
   * Set the node ID being dragged from toolbar
   */
  setToolbarDragNodeId(nodeId: string | null): void {
    if (typeof window === 'undefined') return;
    (window as any).__isToolbarDrag = nodeId;
  }

  /**
   * Check if node drag should be blocked
   */
  isNodeDragBlocked(): boolean {
    if (typeof window === 'undefined') return false;
    return (window as any).__blockNodeDrag || false;
  }

  /**
   * Set block node drag state
   */
  setBlockNodeDrag(block: boolean): void {
    if (typeof window === 'undefined') return;
    (window as any).__blockNodeDrag = block;
  }

  /**
   * Get last mouse position
   */
  getLastMousePosition(): { x: number; y: number } {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    return {
      x: (window as any).__lastMouseX || 0,
      y: (window as any).__lastMouseY || 0,
    };
  }

  /**
   * Set last mouse position
   */
  setLastMousePosition(x: number, y: number): void {
    if (typeof window === 'undefined') return;
    (window as any).__lastMouseX = x;
    (window as any).__lastMouseY = y;
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
