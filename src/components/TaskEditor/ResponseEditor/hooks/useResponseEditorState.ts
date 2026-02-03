/**
 * useResponseEditorState
 *
 * Custom hook that centralizes all state management for ResponseEditor.
 * Extracted from index.tsx to improve maintainability and separation of concerns.
 *
 * This hook manages all useState declarations and provides a clean interface
 * for state access and updates.
 */

import { useState } from 'react';
import type { RightPanelMode } from '../RightPanel';

export interface ResponseEditorState {
  // Service unavailable
  serviceUnavailable: {
    service: string;
    message: string;
    endpoint?: string;
    onRetry?: () => void;
  } | null;
  setServiceUnavailable: React.Dispatch<React.SetStateAction<{
    service: string;
    message: string;
    endpoint?: string;
    onRetry?: () => void;
  } | null>>;

  // Contract change dialog
  showContractDialog: boolean;
  setShowContractDialog: React.Dispatch<React.SetStateAction<boolean>>;
  pendingContractChange: {
    templateId: string;
    templateLabel: string;
    modifiedContract: any;
  } | null;
  setPendingContractChange: React.Dispatch<React.SetStateAction<{
    templateId: string;
    templateLabel: string;
    modifiedContract: any;
  } | null>>;

  // Escalation tasks
  escalationTasks: any[];
  setEscalationTasks: React.Dispatch<React.SetStateAction<any[]>>;

  // Pending editor
  pendingEditorOpen: {
    editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings';
    nodeId: string;
  } | null;
  setPendingEditorOpen: React.Dispatch<React.SetStateAction<{
    editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings';
    nodeId: string;
  } | null>>;

  // UI panels visibility
  showSynonyms: boolean;
  setShowSynonyms: React.Dispatch<React.SetStateAction<boolean>>;
  showMessageReview: boolean;
  setShowMessageReview: React.Dispatch<React.SetStateAction<boolean>>;
  selectedIntentIdForTraining: string | null;
  setSelectedIntentIdForTraining: React.Dispatch<React.SetStateAction<string | null>>;
  showContractWizard: boolean;
  setShowContractWizard: React.Dispatch<React.SetStateAction<boolean>>;

  // Selected node
  selectedNode: any;
  setSelectedNode: React.Dispatch<React.SetStateAction<any>>;
  selectedNodePath: {
    mainIndex: number;
    subIndex?: number;
  } | null;
  setSelectedNodePath: React.Dispatch<React.SetStateAction<{
    mainIndex: number;
    subIndex?: number;
  } | null>>;

  // TaskTree version (for forcing re-renders)
  taskTreeVersion: number;
  setTaskTreeVersion: React.Dispatch<React.SetStateAction<number>>;

  // Panel modes
  leftPanelMode: RightPanelMode;
  setLeftPanelMode: React.Dispatch<React.SetStateAction<RightPanelMode>>;
  testPanelMode: RightPanelMode;
  setTestPanelMode: React.Dispatch<React.SetStateAction<RightPanelMode>>;
  tasksPanelMode: RightPanelMode;
  setTasksPanelMode: React.Dispatch<React.SetStateAction<RightPanelMode>>;

  // Sidebar drag state
  sidebarManualWidth: number | null;
  setSidebarManualWidth: React.Dispatch<React.SetStateAction<number | null>>;
  isDraggingSidebar: boolean;
  setIsDraggingSidebar: React.Dispatch<React.SetStateAction<boolean>>;

  // Splitter drag state
  draggingPanel: 'left' | 'test' | 'tasks' | 'shared' | null;
  setDraggingPanel: React.Dispatch<React.SetStateAction<'left' | 'test' | 'tasks' | 'shared' | null>>;
}

/**
 * Hook that manages all state for ResponseEditor
 */
export function useResponseEditorState(): ResponseEditorState {
  // Service unavailable
  const [serviceUnavailable, setServiceUnavailable] = useState<{
    service: string;
    message: string;
    endpoint?: string;
    onRetry?: () => void;
  } | null>(null);

  // Contract change dialog
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [pendingContractChange, setPendingContractChange] = useState<{
    templateId: string;
    templateLabel: string;
    modifiedContract: any;
  } | null>(null);

  // Escalation tasks
  const [escalationTasks, setEscalationTasks] = useState<any[]>([]);

  // Pending editor
  const [pendingEditorOpen, setPendingEditorOpen] = useState<{
    editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings';
    nodeId: string;
  } | null>(null);

  // UI panels visibility
  const [showSynonyms, setShowSynonyms] = useState(false);
  const [showMessageReview, setShowMessageReview] = useState(false);
  const [selectedIntentIdForTraining, setSelectedIntentIdForTraining] = useState<string | null>(null);
  const [showContractWizard, setShowContractWizard] = useState(false);

  // Selected node
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedNodePath, setSelectedNodePath] = useState<{
    mainIndex: number;
    subIndex?: number;
  } | null>(null);

  // TaskTree version (for forcing re-renders)
  const [taskTreeVersion, setTaskTreeVersion] = useState(0);

  // Panel modes
  const [leftPanelMode, setLeftPanelMode] = useState<RightPanelMode>('actions');
  const [testPanelMode, setTestPanelMode] = useState<RightPanelMode>('none');
  const [tasksPanelMode, setTasksPanelMode] = useState<RightPanelMode>('none');

  // Sidebar drag state
  const [sidebarManualWidth, setSidebarManualWidth] = useState<number | null>(null);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);

  // Splitter drag state
  const [draggingPanel, setDraggingPanel] = useState<'left' | 'test' | 'tasks' | 'shared' | null>(null);

  return {
    // Service unavailable
    serviceUnavailable,
    setServiceUnavailable,

    // Contract change dialog
    showContractDialog,
    setShowContractDialog,
    pendingContractChange,
    setPendingContractChange,

    // Escalation tasks
    escalationTasks,
    setEscalationTasks,

    // Pending editor
    pendingEditorOpen,
    setPendingEditorOpen,

    // UI panels visibility
    showSynonyms,
    setShowSynonyms,
    showMessageReview,
    setShowMessageReview,
    selectedIntentIdForTraining,
    setSelectedIntentIdForTraining,
    showContractWizard,
    setShowContractWizard,

    // Selected node
    selectedNode,
    setSelectedNode,
    selectedNodePath,
    setSelectedNodePath,

    // TaskTree version
    taskTreeVersion,
    setTaskTreeVersion,

    // Panel modes
    leftPanelMode,
    setLeftPanelMode,
    testPanelMode,
    setTestPanelMode,
    tasksPanelMode,
    setTasksPanelMode,

    // Sidebar drag state
    sidebarManualWidth,
    setSidebarManualWidth,
    isDraggingSidebar,
    setIsDraggingSidebar,

    // Splitter drag state
    draggingPanel,
    setDraggingPanel,
  };
}
