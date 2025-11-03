import React, { useCallback, useState, useRef, useMemo } from 'react';
import { Node, Edge } from 'reactflow';
import { NodeData, EdgeData } from '../../Flowchart/types/flowTypes';
import { useProjectData } from '../../../context/ProjectDataContext';
import type { AssembledDDT } from '../../../DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types';
import { instanceRepository } from '../../../services/InstanceRepository';

function findEntryNodes(nodes: Node<NodeData>[], edges: Edge<EdgeData>[]): Node<NodeData>[] {
  const targets = new Set((edges || []).map(e => e.target));
  return (nodes || []).filter(n => !targets.has(n.id));
}

function nextNodes(nodeId: string, edges: Edge<EdgeData>[]): string[] {
  return (edges || []).filter(e => e.source === nodeId).map(e => e.target);
}

interface UseFlowOrchestratorProps {
  nodes: Node<NodeData>[];
  edges: Edge<EdgeData>[];
}

interface FlowOrchestratorState {
  currentNodeId: string | null;
  currentActIndex: number;
  queue: string[];
  isRunning: boolean;
  currentDDT: AssembledDDT | null;
  activeContext: { blockName: string; actName: string } | null;
  variableStore: Record<string, any>;
}

export function useFlowOrchestrator({ nodes, edges }: UseFlowOrchestratorProps) {
  const { data } = useProjectData();

  const [state, setState] = useState<FlowOrchestratorState>({
    currentNodeId: null,
    currentActIndex: 0,
    queue: [],
    isRunning: false,
    currentDDT: null,
    activeContext: null,
    variableStore: {}
  });

  // Normalize various DDT shapes (embedded snapshot with 'mains' → assembled with mainData)
  const toAssembled = useCallback((raw: any): AssembledDDT | null => {
    if (!raw) return null;
    if (raw.mainData) return raw; // already assembled
    // Embedded snapshot with 'mains'
    const mains = Array.isArray(raw.mains) ? raw.mains : [];
    if (mains.length === 0) return raw;
    const mapNode = (m: any): any => ({
      id: m.id || Math.random().toString(36).slice(2),
      label: m.labelKey || m.label || 'Data',
      type: m.kind || m.type,
      steps: m.steps || {},
      subData: (m.subs || []).map((s: any) => ({
        id: s.id || Math.random().toString(36).slice(2),
        label: s.labelKey || s.label || 'Field',
        type: s.kind || s.type,
        steps: s.steps || {},
      }))
    });
    const nodes = mains.map(mapNode);
    return {
      id: raw.id || raw._id || `runtime.${Math.random().toString(36).slice(2)}`,
      label: raw.labelKey || raw.label || 'Data',
      mainData: nodes.length === 1 ? nodes[0] : nodes,
      translations: (raw.translations && (raw.translations.en || raw.translations)) || {}
    };
  }, []);

  const normalizeName = useCallback((s?: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, '_'), []);

  const resolveAct = useCallback((row: any) => {
    const a: any = row?.act || row;
    // resolve by id or name from project data
    const cats: any[] = (data?.agentActs || []) as any[];
    for (const c of cats) {
      for (const it of (c.items || [])) {
        if ((a?.id && (it.id === a.id || it._id === a.id)) || (String(it?.name || '').trim() === String(a?.name || row?.text || '').trim())) {
          return it;
        }
      }
    }
    return a;
  }, [data]);

  const actIsInteractive = useCallback((row: any) => {
    const it = resolveAct(row);
    const mode = it?.mode || (row as any)?.mode;
    return Boolean(it?.ddt || (mode && ['DataRequest', 'DataConfirmation'].includes(mode)));
  }, [resolveAct]);

  const actMessage = useCallback((row: any) => {
    // For Message acts, read text from instance (row.id is the instanceId)
    const instanceId = row?.id;
    if (instanceId) {
      const instance = instanceRepository.getInstance(instanceId);
      try {
        console.log('[FlowOrchestrator][actMessage] Checking instance', {
          instanceId,
          hasInstance: !!instance,
          hasMessage: !!instance?.message,
          messageText: instance?.message?.text,
          messageTextLength: instance?.message?.text?.length || 0
        });
      } catch { }

      if (instance?.message?.text) {
        return instance.message.text;
      }

      // If instance exists but has no message.text, try to create it or check if it's being created
      if (instance && !instance.message) {
        try {
          console.warn('[FlowOrchestrator][actMessage] Instance exists but has no message field', { instanceId });
        } catch { }
      }
    } else {
      try {
        console.warn('[FlowOrchestrator][actMessage] No instanceId for row', { rowId: row?.id, rowText: row?.text });
      } catch { }
    }

    // For other acts, try prompts
    const it: any = resolveAct(row);
    const promptText = (it?.prompts && (it.prompts.informal || it.prompts.formal)) || '';

    try {
      if (!promptText) {
        console.warn('[FlowOrchestrator][actMessage] No text found from instance or prompts', {
          instanceId,
          rowText: row?.text,
          hasPrompt: !!(it?.prompts),
          promptText
        });
      }
    } catch { }

    return promptText;
  }, [resolveAct]);

  const start = useCallback(() => {
    const entries = findEntryNodes(nodes, edges);
    const ordered = entries.map(e => e.id);

    // Validazione: se non ci sono entry nodes, non partire
    if (ordered.length === 0) {
      console.warn('[FlowOrchestrator] No entry nodes found. Cannot start flow.');
      return;
    }

    const firstNodeId = ordered[0] || null;

    // Set initial state
    setState(prev => ({
      ...prev,
      queue: ordered,
      currentNodeId: firstNodeId,
      currentActIndex: 0,
      isRunning: true,
      currentDDT: null,
      activeContext: null
    }));

    // Drain will be handled by useEffect in DDEBubbleChat after state is set
  }, [nodes, edges]);

  const stop = useCallback(() => {
    setState(prev => ({
      ...prev,
      isRunning: false,
      queue: [],
      currentNodeId: null,
      currentActIndex: 0,
      currentDDT: null,
      activeContext: null,
      variableStore: {}
    }));
  }, []);

  const drainSequentialNonInteractiveFrom = useCallback((startIndex: number): {
    emitted: boolean;
    nextIndex: number;
    nextDDT: AssembledDDT | null;
    nextContext: { blockName: string; actName: string } | null;
    messages: Array<{ role: 'agent' | 'system' | 'user'; text: string; interactive: false; fromDDT: false }>;
  } => {
    if (!state.currentNodeId) {
      return { emitted: false, nextIndex: startIndex, nextDDT: null, nextContext: null, messages: [] };
    }

    const node = nodes.find(n => n.id === state.currentNodeId);
    const rows = (node?.data?.rows || []) as any[];
    const total = rows.length;
    let idx = startIndex;
    let emitted = false;

    // Emit non-interactive messages
    const nonInteractiveMessages: Array<{ role: 'agent' | 'system' | 'user'; text: string; interactive: false; fromDDT: false }> = [];

    try {
      console.log('[FlowOrchestrator][drain] Starting drain', {
        startIndex,
        total,
        nodeId: state.currentNodeId,
        nodeTitle: node?.data?.title,
        rows: rows.map((r: any) => ({ id: r?.id, text: r?.text, type: r?.type, mode: r?.mode }))
      });
    } catch { }

    while (idx < total && !actIsInteractive(rows[idx])) {
      const row = rows[idx];
      const isInteractive = actIsInteractive(row);
      const msg = actMessage(row);

      try {
        console.log('[FlowOrchestrator][drain] Processing row', { idx, rowId: row?.id, rowText: row?.text, isInteractive, msgLength: msg?.length || 0, hasMsg: !!msg });
      } catch { }

      // Always increment idx and add message (even if empty) to process all non-interactive acts
      if (msg) {
        emitted = true;
        nonInteractiveMessages.push({ role: 'agent', text: msg, interactive: false, fromDDT: false });
        try {
          console.log('[FlowOrchestrator][drain] Added message', { idx, text: msg.substring(0, 50) });
        } catch { }
      } else {
        // Log if message is empty but act is non-interactive (for debugging)
        try {
          console.warn('[FlowOrchestrator][drain] Empty message for non-interactive act:', { idx, rowId: row?.id, rowText: row?.text, rowType: row?.type, rowMode: row?.mode });
        } catch { }
      }
      idx += 1;
    }

    try {
      console.log('[FlowOrchestrator][drain] Drain complete', { nextIndex: idx, messagesCount: nonInteractiveMessages.length, emitted });
    } catch { }

    // If we hit an interactive act, prepare DDT
    let nextDDT: AssembledDDT | null = null;
    let nextContext: { blockName: string; actName: string } | null = null;

    if (idx < total && actIsInteractive(rows[idx])) {
      const it: any = resolveAct(rows[idx]);
      if (it?.ddt) {
        const assembled = toAssembled(it.ddt);
        nextDDT = assembled;

        // Capture active context
        try {
          const node = nodes.find(n => n.id === state.currentNodeId);
          const title = (node?.data as any)?.title || '';
          const blockIndex = Math.max(0, (nodes || []).findIndex(n => n.id === state.currentNodeId));
          const blockName = normalizeName(title) || `blocco${blockIndex + 1}`;
          const actName = normalizeName(it?.name || it?.label || rows[idx]?.text || 'act');
          nextContext = { blockName, actName };
        } catch { }
      }
    }

    return { emitted, nextIndex: idx, nextDDT, nextContext, messages: nonInteractiveMessages };
  }, [state.currentNodeId, nodes, actIsInteractive, actMessage, resolveAct, toAssembled, normalizeName]);

  const nextAct = useCallback(() => {
    if (!state.currentNodeId) return;

    const node = nodes.find(n => n.id === state.currentNodeId);
    const total = (node?.data?.rows || []) as any[];
    const nextIdx = state.currentActIndex + 1;

    if (nextIdx < total) {
      // Move to next act in same node
      const drainResult = drainSequentialNonInteractiveFrom(nextIdx);
      setState(prev => ({
        ...prev,
        currentActIndex: drainResult.nextIndex,
        currentDDT: drainResult.nextDDT,
        activeContext: drainResult.nextContext
      }));
    } else {
      // Move to next node
      const nextIds = nextNodes(state.currentNodeId, edges);
      const first = nextIds[0];

      if (first) {
        // Move to next node
        const drainResult = drainSequentialNonInteractiveFrom(0);
        setState(prev => ({
          ...prev,
          currentNodeId: first,
          currentActIndex: drainResult.nextIndex,
          currentDDT: drainResult.nextDDT,
          activeContext: drainResult.nextContext
        }));
      } else {
        // Finished branch; try next entry
        if (state.queue.length > 1) {
          const [, ...rest] = state.queue;
          const drainResult = drainSequentialNonInteractiveFrom(0);
          setState(prev => ({
            ...prev,
            queue: rest,
            currentNodeId: rest[0] || null,
            currentActIndex: drainResult.nextIndex,
            currentDDT: drainResult.nextDDT,
            activeContext: drainResult.nextContext
          }));
        } else {
          // All done
          setState(prev => ({ ...prev, isRunning: false }));
        }
      }
    }
  }, [state.currentNodeId, state.currentActIndex, state.queue, nodes, edges, drainSequentialNonInteractiveFrom]);

  const getCurrentNode = useCallback((): Node<NodeData> | undefined => {
    return state.currentNodeId ? nodes.find(n => n.id === state.currentNodeId) : undefined;
  }, [state.currentNodeId, nodes]);

  const updateVariableStore = useCallback((updater: (prev: Record<string, any>) => Record<string, any>) => {
    setState(prev => ({
      ...prev,
      variableStore: updater(prev.variableStore)
    }));
  }, []);

  const setCurrentDDT = useCallback((ddt: AssembledDDT | null) => {
    setState(prev => ({ ...prev, currentDDT: ddt }));
  }, []);

  const onDDTCompleted = useCallback(() => {
    nextAct();
  }, [nextAct]);

  // Expose drain result including messages for initial drain
  const drainInitialMessages = useCallback(() => {
    if (!state.isRunning || !state.currentNodeId) {
      return { messages: [], nextIndex: 0, nextDDT: null, nextContext: null };
    }
    return drainSequentialNonInteractiveFrom(0);
  }, [state.isRunning, state.currentNodeId, drainSequentialNonInteractiveFrom]);

  return {
    // State
    currentNodeId: state.currentNodeId,
    currentActIndex: state.currentActIndex,
    isRunning: state.isRunning,
    currentDDT: state.currentDDT,
    activeContext: state.activeContext,
    variableStore: state.variableStore,

    // Actions
    start,
    stop,
    nextAct,
    getCurrentNode,
    drainSequentialNonInteractiveFrom,
    drainInitialMessages,
    updateVariableStore,
    setCurrentDDT,
    onDDTCompleted
  };
}

