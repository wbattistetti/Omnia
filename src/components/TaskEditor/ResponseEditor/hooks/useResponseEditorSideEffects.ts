/**
 * useResponseEditorSideEffects
 *
 * Custom hook that orchestrates all side-effects for ResponseEditor.
 * This hook delegates to thematic hooks for better separation of concerns.
 *
 * Delegates to:
 * - useServiceEvents: Service unavailable events
 * - useEscalationTasks: Escalation tasks loading
 * - usePendingEditorClear: Pending editor clearing
 * - useTemplateSync: Template sync check
 * - useDebugFlags: Debug flags setup
 * - useProjectSave: Project save handler
 * - useSidebarCleanup: Sidebar resize cleanup
 * - useSidebarDrag: Sidebar drag handlers
 * - useEditorCloseRegistration: HandleEditorClose ref update and registration
 * - useSplitterDrag: Splitter drag handlers
 * - useToolbarSync: Toolbar update
 */

import { useServiceEvents } from './useServiceEvents';
import { useEscalationTasks } from './useEscalationTasks';
import { usePendingEditorClear } from './usePendingEditorClear';
import { useTemplateSync } from './useTemplateSync';
import { useDebugFlags } from './useDebugFlags';
import { useProjectSave } from './useProjectSave';
// ✅ FASE 2.1: Sidebar hooks consolidated into useSidebar composito
// import { useSidebarCleanup } from './useSidebarCleanup'; // Consolidated
// import { useSidebarDrag } from './useSidebarDrag'; // Consolidated
import { useEditorCloseRegistration } from './useEditorCloseRegistration';
import { useSplitterDrag } from './useSplitterDrag';
import { useToolbarSync } from './useToolbarSync';
import type { Task, TaskTree } from '@types/taskTypes';

interface UseResponseEditorSideEffectsProps {
  // Task and tree
  task?: Task | null;
  taskTree?: TaskTree | null;
  // ✅ FASE 3: taskTreeRef rimosso - store è single source of truth
  currentProjectId: string | null;
  setTaskTreeVersion: React.Dispatch<React.SetStateAction<number>>;
  prevInstanceRef: React.MutableRefObject<string | undefined>;

  // Service unavailable
  setServiceUnavailable: React.Dispatch<React.SetStateAction<{
    service: string;
    message: string;
    endpoint?: string;
    onRetry?: () => void;
  } | null>>;

  // Escalation tasks
  setEscalationTasks: React.Dispatch<React.SetStateAction<any[]>>;

  // Pending editor
  pendingEditorOpen: {
    editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings';
    nodeId: string;
  } | null;
  showSynonyms: boolean;
  selectedNode: any;
  setPendingEditorOpen: React.Dispatch<React.SetStateAction<{
    editorType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings';
    nodeId: string;
  } | null>>;

  // Template sync
  replaceSelectedTaskTree: (taskTree: TaskTree) => void;

  // Sidebar drag
  isDraggingSidebar: boolean;
  setIsDraggingSidebar: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarStartWidthRef: React.MutableRefObject<number>;
  sidebarStartXRef: React.MutableRefObject<number>;
  setSidebarManualWidth: React.Dispatch<React.SetStateAction<number | null>>;

  // HandleEditorClose
  handleEditorClose: () => Promise<boolean>;
  registerOnClose?: (fn: () => Promise<boolean>) => void;

  // Splitter drag
  draggingPanel: 'left' | 'test' | 'tasks' | 'shared' | null;
  setDraggingPanel: React.Dispatch<React.SetStateAction<'left' | 'test' | 'tasks' | 'shared' | null>>;
  rightWidth: number;
  setRightWidth: (width: number) => void;
  testPanelWidth: number;
  setTestPanelWidth: (width: number) => void;
  tasksPanelWidth: number;
  setTasksPanelWidth: (width: number) => void;
  tasksPanelMode: string;
  testPanelMode: string;
  tasksStartWidthRef: React.MutableRefObject<number>;
  tasksStartXRef: React.MutableRefObject<number>;

  // Toolbar
  hideHeader?: boolean;
  onToolbarUpdate?: (toolbar: any[], color: string) => void;
  toolbarButtons: any[];
}

export function useResponseEditorSideEffects(props: UseResponseEditorSideEffectsProps) {
  const {
    task,
    taskTree,
    currentProjectId,
    setTaskTreeVersion,
    prevInstanceRef,
    setServiceUnavailable,
    setEscalationTasks,
    pendingEditorOpen,
    showSynonyms,
    selectedNode,
    setPendingEditorOpen,
    replaceSelectedTaskTree,
    isDraggingSidebar,
    setIsDraggingSidebar,
    sidebarStartWidthRef,
    sidebarStartXRef,
    setSidebarManualWidth,
    handleEditorClose,
    registerOnClose,
    draggingPanel,
    setDraggingPanel,
    rightWidth,
    setRightWidth,
    testPanelWidth,
    setTestPanelWidth,
    tasksPanelWidth,
    setTasksPanelWidth,
    tasksPanelMode,
    testPanelMode,
    tasksStartWidthRef,
    tasksStartXRef,
    hideHeader,
    onToolbarUpdate,
    toolbarButtons,
  } = props;

  // Delegate to thematic hooks
  useServiceEvents({ setServiceUnavailable });
  useEscalationTasks({ setEscalationTasks });
  usePendingEditorClear({ pendingEditorOpen, showSynonyms, selectedNode, setPendingEditorOpen });
  useTemplateSync({ task, taskTree, currentProjectId, prevInstanceRef, replaceSelectedTaskTree });
  useDebugFlags();
  useProjectSave({ task, currentProjectId });
  // ✅ FASE 2.1: Sidebar functionality now handled by useSidebar composito in useResponseEditorHandlers
  // useSidebarCleanup(); // Consolidated into useSidebar
  // useSidebarDrag({ isDraggingSidebar, sidebarStartWidthRef, sidebarStartXRef, setSidebarManualWidth, setIsDraggingSidebar }); // Consolidated into useSidebar
  useEditorCloseRegistration({ handleEditorClose, registerOnClose });
  useSplitterDrag({ draggingPanel, setDraggingPanel, rightWidth, setRightWidth, testPanelWidth, setTestPanelWidth, tasksPanelWidth, setTasksPanelWidth, tasksPanelMode, testPanelMode, tasksStartWidthRef, tasksStartXRef });
  useToolbarSync({ hideHeader, onToolbarUpdate, toolbarButtons });
}
