/**
 * useResponseEditorSideEffects
 *
 * Custom hook that manages all side-effects for ResponseEditor.
 * Extracted from index.tsx to improve maintainability and separation of concerns.
 *
 * This hook handles:
 * - Service unavailable events
 * - Escalation tasks loading
 * - Pending editor clearing
 * - TaskTree synchronization
 * - Template sync check
 * - Debug flags setup
 * - Project save handler
 * - Sidebar resize cleanup
 * - Sidebar drag handlers
 * - HandleEditorClose ref update
 * - Register onClose
 * - Splitter drag handlers
 * - Toolbar update
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { saveTaskOnProjectSave, checkAndApplyTemplateSync } from '../modules/ResponseEditor/persistence/ResponseEditorPersistence';
import { getdataList } from '../ddtSelectors';
import type { Task, TaskTree } from '../../../../types/taskTypes';

interface UseResponseEditorSideEffectsProps {
  // Task and tree
  task?: Task | null;
  taskTree?: TaskTree | null;
  taskTreeRef: React.MutableRefObject<TaskTree | null | undefined>;
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
  sidebarRef: React.RefObject<HTMLDivElement>;
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
    taskTreeRef,
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
    sidebarRef,
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

  // ✅ Listen for service unavailable events
  useEffect(() => {
    const handleServiceUnavailable = (event: CustomEvent) => {
      const { service, message, endpoint, onRetry } = event.detail || {};
      setServiceUnavailable({ service, message, endpoint, onRetry });
    };

    window.addEventListener('service:unavailable' as any, handleServiceUnavailable);
    return () => {
      window.removeEventListener('service:unavailable' as any, handleServiceUnavailable);
    };
  }, [setServiceUnavailable]);

  // ✅ Load tasks for escalation palette
  useEffect(() => {
    fetch('/api/factory/tasks?taskType=Action')
      .then(res => {
        if (!res.ok) {
          console.warn('[ResponseEditor] Failed to load escalation tasks: HTTP', res.status);
          return [];
        }
        return res.json();
      })
      .then(templates => {
        if (!Array.isArray(templates)) {
          console.warn('[ResponseEditor] Invalid response format, expected array, got:', typeof templates, templates);
          setEscalationTasks([]);
          return;
        }

        const tasks = templates.map((template: any) => ({
          id: template.id || template._id,
          label: template.label || '',
          description: template.description || '',
          icon: template.icon || 'Circle',
          color: template.color || 'text-gray-500',
          params: template.structure || template.params || {},
          type: template.type,
          allowedContexts: template.allowedContexts || []
        }));

        setEscalationTasks(tasks);
      })
      .catch(err => {
        console.error('[ResponseEditor] Failed to load escalation tasks', err);
        setEscalationTasks([]);
      });
  }, [setEscalationTasks]);

  // ✅ Clear pending editor after it's been opened
  useEffect(() => {
    if (pendingEditorOpen && showSynonyms && selectedNode) {
      const nodeId = selectedNode.id || selectedNode.templateId;
      if (nodeId === pendingEditorOpen.nodeId) {
        const timer = setTimeout(() => {
          setPendingEditorOpen(null);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [pendingEditorOpen, showSynonyms, selectedNode, setPendingEditorOpen]);

  // ✅ Sincronizza taskTreeRef.current con taskTree prop (fonte di verità dal dockTree)
  useEffect(() => {
    const instance = task?.instanceId || task?.id;
    const isNewInstance = prevInstanceRef.current !== instance;

    if (isNewInstance) {
      taskTreeRef.current = taskTree;
      prevInstanceRef.current = instance;
      const currentList = getdataList(taskTree);
      if (currentList && currentList.length > 0) {
        setTaskTreeVersion(v => v + 1);
      }
    } else if (taskTree && taskTree !== taskTreeRef.current) {
      const currentList = getdataList(taskTree);
      const prevList = getdataList(taskTreeRef.current);
      const taskTreeChanged = taskTree !== taskTreeRef.current ||
        (currentList?.length !== prevList?.length);
      if (taskTreeChanged) {
        taskTreeRef.current = taskTree;
        if (currentList && currentList.length > 0) {
          setTaskTreeVersion(v => v + 1);
        }
      }
    }
  }, [taskTree, task?.instanceId, task?.id, taskTreeRef, prevInstanceRef, setTaskTreeVersion]);

  // ✅ Check for template sync when task is opened
  useEffect(() => {
    const checkTemplateSync = async () => {
      if (!taskTree || !task?.templateId) return;

      const syncApplied = await checkAndApplyTemplateSync(taskTree, task, currentProjectId);
      if (syncApplied) {
        taskTreeRef.current = { ...taskTree };
        replaceSelectedTaskTree(taskTreeRef.current);
      }
    };

    if (taskTree && task?.templateId && prevInstanceRef.current === (task?.instanceId || task?.id)) {
      checkTemplateSync();
    }
  }, [taskTree, task?.templateId, task?.instanceId, task?.id, replaceSelectedTaskTree, currentProjectId, taskTreeRef, prevInstanceRef]);

  // ✅ Ensure debug flag is set once to avoid asking again
  useEffect(() => {
    try { localStorage.setItem('debug.responseEditor', '1'); } catch { }
    try { localStorage.setItem('debug.reopen', '1'); } catch { }
    try { localStorage.setItem('debug.nodeSelection', '1'); } catch { }
    try { localStorage.setItem('debug.nodeSync', '1'); } catch { }
    try { localStorage.setItem('debug.useDDTTranslations', '1'); } catch { }
    try { localStorage.setItem('debug.getTaskText', '1'); } catch { }
  }, []);

  // ✅ Salva modifiche quando si clicca "Salva" nel progetto
  useEffect(() => {
    const handleProjectSave = async () => {
      if (task?.id || task?.instanceId) {
        const key = (task?.instanceId || task?.id) as string;
        const currentTaskTree = taskTreeRef.current;
        await saveTaskOnProjectSave(key, currentTaskTree, task, currentProjectId);
      }
    };

    window.addEventListener('project:save', handleProjectSave);
    return () => {
      window.removeEventListener('project:save', handleProjectSave);
    };
  }, [task?.id, (task as any)?.instanceId, currentProjectId, taskTreeRef, task]);

  // ✅ Pulisci localStorage all'avvio per garantire che autosize prevalga
  useEffect(() => {
    try {
      localStorage.removeItem('responseEditor.sidebarWidth');
    } catch { }
  }, []);

  // ✅ Sidebar drag handlers
  useEffect(() => {
    if (!isDraggingSidebar) {
      return;
    }

    const handleMove = (e: MouseEvent) => {
      const deltaX = e.clientX - sidebarStartXRef.current;
      const MIN_WIDTH = 160;
      const MAX_WIDTH = 1000;
      const calculatedWidth = sidebarStartWidthRef.current + deltaX;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, calculatedWidth));

      setSidebarManualWidth(newWidth);
    };

    const handleUp = () => {
      setIsDraggingSidebar(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDraggingSidebar, sidebarStartWidthRef, sidebarStartXRef, setSidebarManualWidth, setIsDraggingSidebar]);

  // ✅ Ref per evitare re-registrazioni quando handleEditorClose cambia
  const handleEditorCloseRef = useRef(handleEditorClose);
  useEffect(() => {
    handleEditorCloseRef.current = handleEditorClose;
  }, [handleEditorClose]);

  // ✅ Registra handleEditorClose nel ref per permettere a tab.onClose di chiamarlo
  useEffect(() => {
    if (registerOnClose) {
      registerOnClose(() => handleEditorCloseRef.current());
      console.log('[ResponseEditor] ✅ Registered handleEditorClose');
    } else {
      console.warn('[ResponseEditor] ⚠️ registerOnClose not provided');
    }
  }, [registerOnClose]);

  // ✅ Splitter drag handlers - gestisce tutti i pannelli in base a draggingPanel
  useEffect(() => {
    if (!draggingPanel) return;

    const onMove = (e: MouseEvent) => {
      const total = window.innerWidth;
      const minWidth = 160;
      const leftMin = 320;

      if (draggingPanel === 'left') {
        const maxRight = Math.max(minWidth, total - leftMin);
        const newWidth = Math.max(minWidth, Math.min(maxRight, total - e.clientX));
        setRightWidth(newWidth);
      } else if (draggingPanel === 'test') {
        const contentLeft = total - (rightWidth || 360);
        if (tasksPanelMode === 'actions' && tasksPanelWidth > 1) {
          const maxTestWidth = total - contentLeft - tasksPanelWidth;
          const newTestWidth = Math.max(minWidth, Math.min(maxTestWidth, e.clientX - contentLeft));
          setTestPanelWidth(newTestWidth);
        } else {
          const maxRight = Math.max(minWidth, total - leftMin);
          const newWidth = Math.max(minWidth, Math.min(maxRight, total - e.clientX));
          setTestPanelWidth(newWidth);
        }
      } else if (draggingPanel === 'tasks') {
        const deltaX = tasksStartXRef.current - e.clientX;
        const newWidth = tasksStartWidthRef.current + deltaX;

        if (testPanelMode === 'chat' && testPanelWidth > 1) {
          const contentLeft = total - (rightWidth || 360);
          const maxTasksWidth = total - contentLeft - testPanelWidth;
          const clampedWidth = Math.max(minWidth, Math.min(maxTasksWidth, newWidth));
          setTasksPanelWidth(clampedWidth);
        } else {
          const maxTasksWidth = total - (rightWidth || 360) - 320;
          const clampedWidth = Math.max(minWidth, Math.min(maxTasksWidth, newWidth));
          setTasksPanelWidth(clampedWidth);
        }
      }
    };

    const onUp = () => setDraggingPanel(null);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingPanel, setRightWidth, setTestPanelWidth, setTasksPanelWidth, rightWidth, tasksPanelWidth, tasksPanelMode, testPanelMode, testPanelWidth, tasksStartWidthRef, tasksStartXRef, setDraggingPanel]);

  // ✅ Esponi toolbar tramite callback quando in docking mode
  const headerColor = '#9a4f00';
  useEffect(() => {
    if (hideHeader && onToolbarUpdate) {
      onToolbarUpdate(toolbarButtons, headerColor);
    }
  }, [hideHeader, onToolbarUpdate, toolbarButtons]);
}
