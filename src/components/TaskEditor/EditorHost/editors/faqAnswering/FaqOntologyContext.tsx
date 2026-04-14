/**
 * State, actions, and debounced persistence of the FAQ ontology tree on the Task document.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { taskRepository } from '@services/TaskRepository';
import type { OntologyNode } from '@types/faqOntology';
import { OntologyDropPosition } from '@types/faqOntology';
import {
  findParentId,
  hasSiblingWithName,
  insertNode,
  insertSiblingAfter,
  insertSiblingBefore,
  isDescendant,
  moveNode as moveNodePure,
  moveNodeIndent,
  moveNodeOutdent,
  moveNodeSiblingDown,
  moveNodeSiblingUp,
  removeNode,
  sortNodesAlphabetical,
  updateNode,
} from '@domain/faqOntology/treeUtils';
import { generateOntologyNodeId } from '@domain/faqOntology/idUtils';

const DEBOUNCE_MS = 900;

export type FaqOntologyContextValue = {
  taskId: string;
  projectId: string | undefined;
  nodes: OntologyNode[];
  displayNodes: OntologyNode[];
  treeName: string;
  selectedNodeId: string | null;
  editMode: boolean;
  alphabetical: boolean;
  saving: boolean;
  debouncing: boolean;
  setSelectedNodeId: (id: string | null) => void;
  setEditMode: (v: boolean) => void;
  setAlphabetical: (v: boolean) => void;
  setTreeName: (name: string) => void;
  clearSelection: () => void;
  addNode: (parentId: string | null, name: string) => void;
  addSiblingBefore: (targetId: string, name: string) => void;
  addSiblingAfter: (targetId: string, name: string) => void;
  renameNode: (id: string, name: string) => void;
  deleteNode: (id: string) => void;
  toggleExpanded: (id: string) => void;
  moveNode: (draggingId: string, targetId: string, position: OntologyDropPosition) => void;
  /** Ctrl/Cmd + frecce: sposta il nodo selezionato (con sottoalbero) nei limiti logici. */
  keyboardMove: (dir: 'left' | 'right' | 'up' | 'down') => void;
  updateGrammar: (id: string, grammar: string[]) => void;
  updateFaqs: (id: string, faqs: string[]) => void;
  checkSiblingName: (parentId: string | null, name: string, excludeId?: string) => boolean;
  canDropOn: (draggingId: string, targetId: string) => boolean;
};

const FaqOntologyContext = createContext<FaqOntologyContextValue | null>(null);

export function useFaqOntology(): FaqOntologyContextValue {
  const ctx = useContext(FaqOntologyContext);
  if (!ctx) {
    throw new Error('useFaqOntology must be used within FaqOntologyProvider');
  }
  return ctx;
}

type Props = {
  taskId: string;
  projectId: string | undefined;
  taskLabel?: string;
  children: React.ReactNode;
};

export function FaqOntologyProvider({ taskId, projectId, taskLabel, children }: Props) {
  const [nodes, setNodes] = useState<OntologyNode[]>([]);
  const [treeName, setTreeNameState] = useState('Untitled Tree');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  /** Default on: altrimenti con albero vuoto non compare alcun controllo per il primo nodo. */
  const [editMode, setEditMode] = useState(true);
  const [alphabetical, setAlphabetical] = useState(false);
  const [saving, setSaving] = useState(false);
  const [debouncing, setDebouncing] = useState(false);

  const treeNameRef = useRef(treeName);
  const taskIdRef = useRef(taskId);
  const projectIdRef = useRef(projectId);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    treeNameRef.current = treeName;
  }, [treeName]);
  useEffect(() => {
    taskIdRef.current = taskId;
  }, [taskId]);
  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  useEffect(() => {
    const t = taskRepository.getTask(taskId);
    if (t) {
      const root = Array.isArray(t.faqAnsweringRoot) ? t.faqAnsweringRoot : [];
      setNodes(root);
      setTreeNameState(
        typeof t.faqAnsweringTreeName === 'string' && t.faqAnsweringTreeName.trim()
          ? t.faqAnsweringTreeName
          : taskLabel?.trim() || 'Untitled Tree'
      );
    }
  }, [taskId, taskLabel]);

  const persist = useCallback((nextNodes: OntologyNode[], nextName?: string) => {
    const tid = taskIdRef.current;
    const pid = projectIdRef.current;
    if (!tid) return;
    setSaving(true);
    taskRepository.updateTask(
      tid,
      {
        faqAnsweringRoot: nextNodes,
        faqAnsweringTreeName: nextName ?? treeNameRef.current,
      } as any,
      pid
    );
    setSaving(false);
  }, []);

  const scheduleSave = useCallback(
    (nextNodes: OntologyNode[], nextName?: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setDebouncing(true);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        setDebouncing(false);
        persist(nextNodes, nextName);
      }, DEBOUNCE_MS);
    },
    [persist]
  );

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

  const displayNodes = useMemo(
    () => (alphabetical ? sortNodesAlphabetical(nodes) : nodes),
    [nodes, alphabetical]
  );

  const setTreeName = useCallback(
    (name: string) => {
      setTreeNameState(name);
      scheduleSave(nodes, name);
    },
    [nodes, scheduleSave]
  );

  const runMutation = useCallback(
    (updater: (prev: OntologyNode[]) => OntologyNode[]) => {
      setNodes((prev) => {
        const next = updater(prev);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  const addNode = useCallback(
    (parentId: string | null, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const newNode: OntologyNode = {
        id: generateOntologyNodeId(),
        name: trimmed,
        grammar: [],
        faqs: [],
        children: [],
        expanded: true,
      };
      runMutation((prev) => {
        if (hasSiblingWithName(prev, parentId, trimmed)) return prev;
        let next = insertNode(prev, parentId, newNode, undefined);
        if (parentId) {
          next = updateNode(next, parentId, (p) => ({ ...p, expanded: true }));
        }
        return next;
      });
    },
    [runMutation]
  );

  const addSiblingBefore = useCallback(
    (targetId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const newNode: OntologyNode = {
        id: generateOntologyNodeId(),
        name: trimmed,
        grammar: [],
        faqs: [],
        children: [],
        expanded: true,
      };
      runMutation((prev) => {
        const pid = findParentId(prev, targetId);
        if (pid === undefined) return prev;
        if (hasSiblingWithName(prev, pid, trimmed)) return prev;
        return insertSiblingBefore(prev, targetId, newNode);
      });
    },
    [runMutation]
  );

  const addSiblingAfter = useCallback(
    (targetId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const newNode: OntologyNode = {
        id: generateOntologyNodeId(),
        name: trimmed,
        grammar: [],
        faqs: [],
        children: [],
        expanded: true,
      };
      runMutation((prev) => {
        const pid = findParentId(prev, targetId);
        if (pid === undefined) return prev;
        if (hasSiblingWithName(prev, pid, trimmed)) return prev;
        return insertSiblingAfter(prev, targetId, newNode);
      });
    },
    [runMutation]
  );

  const renameNode = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const pid = findParentId(nodes, id);
      if (pid === undefined) return;
      if (hasSiblingWithName(nodes, pid, trimmed, id)) return;
      runMutation((prev) => updateNode(prev, id, (n) => ({ ...n, name: trimmed })));
    },
    [nodes, runMutation]
  );

  const deleteNode = useCallback(
    (id: string) => {
      runMutation((prev) => removeNode(prev, id).tree);
      setSelectedNodeId((s) => (s === id ? null : s));
    },
    [runMutation]
  );

  const toggleExpanded = useCallback(
    (id: string) => {
      runMutation((prev) =>
        updateNode(prev, id, (n) => ({ ...n, expanded: !n.expanded }))
      );
    },
    [runMutation]
  );

  const moveNode = useCallback(
    (draggingId: string, targetId: string, position: OntologyDropPosition) => {
      if (draggingId === targetId) return;
      if (position === OntologyDropPosition.Inside && isDescendant(nodes, draggingId, targetId)) {
        return;
      }
      runMutation((prev) => moveNodePure(prev, draggingId, targetId, position));
    },
    [nodes, runMutation]
  );

  const keyboardMove = useCallback(
    (dir: 'left' | 'right' | 'up' | 'down') => {
      const id = selectedNodeId;
      if (!id || !editMode) return;
      runMutation((prev) => {
        switch (dir) {
          case 'right':
            return moveNodeIndent(prev, id);
          case 'left':
            return moveNodeOutdent(prev, id);
          case 'up':
            return moveNodeSiblingUp(prev, id);
          case 'down':
            return moveNodeSiblingDown(prev, id);
          default:
            return prev;
        }
      });
    },
    [editMode, runMutation, selectedNodeId]
  );

  const updateGrammar = useCallback(
    (id: string, grammar: string[]) => {
      runMutation((prev) => updateNode(prev, id, (n) => ({ ...n, grammar })));
    },
    [runMutation]
  );

  const updateFaqs = useCallback(
    (id: string, faqs: string[]) => {
      runMutation((prev) => updateNode(prev, id, (n) => ({ ...n, faqs })));
    },
    [runMutation]
  );

  const checkSiblingName = useCallback(
    (parentId: string | null, name: string, excludeId?: string) =>
      !hasSiblingWithName(nodes, parentId, name, excludeId),
    [nodes]
  );

  const canDropOn = useCallback(
    (draggingId: string, targetId: string) => {
      if (draggingId === targetId) return false;
      if (isDescendant(nodes, draggingId, targetId)) return false;
      return true;
    },
    [nodes]
  );

  const clearSelection = useCallback(() => setSelectedNodeId(null), []);

  const value = useMemo<FaqOntologyContextValue>(
    () => ({
      taskId,
      projectId,
      nodes,
      displayNodes,
      treeName,
      selectedNodeId,
      editMode,
      alphabetical,
      saving,
      debouncing,
      setSelectedNodeId,
      setEditMode,
      setAlphabetical,
      setTreeName,
      clearSelection,
      addNode,
      addSiblingBefore,
      addSiblingAfter,
      renameNode,
      deleteNode,
      toggleExpanded,
      moveNode,
      keyboardMove,
      updateGrammar,
      updateFaqs,
      checkSiblingName,
      canDropOn,
    }),
    [
      taskId,
      projectId,
      nodes,
      displayNodes,
      treeName,
      selectedNodeId,
      editMode,
      alphabetical,
      saving,
      debouncing,
      addNode,
      addSiblingBefore,
      addSiblingAfter,
      renameNode,
      deleteNode,
      toggleExpanded,
      moveNode,
      keyboardMove,
      updateGrammar,
      updateFaqs,
      checkSiblingName,
      canDropOn,
      clearSelection,
      setTreeName,
    ]
  );

  return <FaqOntologyContext.Provider value={value}>{children}</FaqOntologyContext.Provider>;
}
