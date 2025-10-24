import React from 'react';
import { Node, Edge } from 'reactflow';
import { NodeData, EdgeData } from '../Flowchart/types/flowTypes';
// import DDTSimulatorPreview from './DDTSimulatorPreview';
import { useProjectData } from '../../context/ProjectDataContext';
import { useDDTManager } from '../../context/DDTManagerContext';
import { adaptCurrentToV2 } from '../DialogueDataEngine/model/adapters/currentToV2';
import { useDDTSimulator } from '../DialogueDataEngine/useSimulator';
import type { DDTTemplateV2 } from '../DialogueDataEngine/model/ddt.v2.types';

interface FlowRunnerProps {
  nodes: Node<NodeData>[];
  edges: Edge<EdgeData>[];
}

function findEntryNodes(nodes: Node<NodeData>[], edges: Edge<EdgeData>[]): Node<NodeData>[] {
  const targets = new Set((edges || []).map(e => e.target));
  return (nodes || []).filter(n => !targets.has(n.id));
}

function nextNodes(nodeId: string, edges: Edge<EdgeData>[]): string[] {
  return (edges || []).filter(e => e.source === nodeId).map(e => e.target);
}

export default function FlowRunner({ nodes, edges }: FlowRunnerProps) {
  const { data } = useProjectData();
  const { dataDialogueTranslations } = useDDTManager();
  const [currentNodeId, setCurrentNodeId] = React.useState<string | null>(null);
  const [queue, setQueue] = React.useState<string[]>([]);
  const [currentActIndex, setCurrentActIndex] = React.useState<number>(0);
  const [isRunning, setIsRunning] = React.useState<boolean>(false);
  const [chat, setChat] = React.useState<Array<{ role: 'agent' | 'system' | 'user'; text: string; interactive?: boolean; fromDDT?: boolean }>>([]);
  const [currentDDT, setCurrentDDT] = React.useState<any | null>(null);
  const [ddtAskEmittedForId, setDdtAskEmittedForId] = React.useState<string | null>(null);
  const [inputText, setInputText] = React.useState<string>('');
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const chatRef = React.useRef<HTMLDivElement | null>(null);

  // DDT engine integration
  const ddtTemplate = React.useMemo<DDTTemplateV2 | null>(() => {
    try {
      if (!currentDDT) return null;
      return adaptCurrentToV2(currentDDT as any);
    } catch {
      return null;
    }
  }, [currentDDT]);
  // Always mount hook; we will drive it only when a DDT is active
  const demoTemplate = React.useMemo<DDTTemplateV2>(() => ({ schemaVersion: '2', metadata: { id: 'DDT_Demo', label: 'Demo' }, nodes: [] } as any), []);
  const { state: ddtState, send: ddtSend, reset: ddtReset } = useDDTSimulator((ddtTemplate || demoTemplate) as DDTTemplateV2, { typingIndicatorMs: 0 });
  const ddtActive = Boolean(currentDDT && ddtTemplate);
  const lastPromptKeyRef = React.useRef<string>('');
  const prevMainIndexRef = React.useRef<number>(-1);
  const successTickRef = React.useRef<string>('');
  const ddtReadyRef = React.useRef<boolean>(false);
  const [variableStore, setVariableStore] = React.useState<Record<string, any>>({});
  const [activeContext, setActiveContext] = React.useState<{ blockName: string; actName: string } | null>(null);
  const planById = React.useMemo<Record<string, any>>(() => {
    const map: Record<string, any> = {};
    try {
      const nodes = (ddtTemplate?.nodes || []) as any[];
      for (const n of nodes) map[n.id] = n;
    } catch { }
    return map;
  }, [ddtTemplate]);

  // Normalize various DDT shapes (embedded snapshot with 'mains' → assembled with mainData)
  const toAssembled = React.useCallback((raw: any): any => {
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

  const normalizeName = React.useCallback((s?: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, '_'), []);
  const stringifyValue = React.useCallback((val: any): string => {
    if (val == null) return '';
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return val.map(v => stringifyValue(v)).join(' ');
    if (typeof val === 'object') return Object.values(val).map(v => stringifyValue(v)).join(' ');
    try { return JSON.stringify(val); } catch { return String(val); }
  }, []);

  const resolveText = React.useCallback((key: string, localDict?: Record<string, string>): string => {
    if (!key) return '';
    // If key already looks like text (contains whitespace and no dot-group pattern), return it as-is
    if (/\s/.test(key) && !/^[\w.-]+\.[\w.-]+/.test(key)) return key;
    const merged: any = { ...(dataDialogueTranslations || {}), ...(localDict || {}) };
    const t = merged[key];
    if (typeof t === 'string' && t.trim().length > 0) return t;
    return key; // fallback to key if no translation available
  }, [dataDialogueTranslations]);

  // Reset engine and local prompt tracking when DDT changes
  React.useEffect(() => {
    if (!ddtActive) return;
    try {
      ddtReset();
      lastPromptKeyRef.current = '';
      prevMainIndexRef.current = -1;
      ddtReadyRef.current = false;
    } catch { }
    // Focus input when a DDT (re)mounts
    try { setTimeout(() => { inputRef.current?.focus({ preventScroll: true } as any); }, 0); } catch { }
  }, [ddtActive, ddtReset]);

  const start = React.useCallback(() => {
    try { console.log('[FlowRunner] start'); } catch { }
    const entries = findEntryNodes(nodes, edges);
    const ordered = entries.map(e => e.id);
    if (ordered.length === 0 && nodes.length > 0) ordered.push(nodes[0].id);
    try { console.log('[FlowRunner] entry nodes', ordered); } catch { }
    setQueue(ordered);
    setCurrentNodeId(ordered[0] || null);
    setCurrentActIndex(0);
    // Reset local DDT tracking
    lastPromptKeyRef.current = '';
    prevMainIndexRef.current = -1;
    setIsRunning(true);
  }, [nodes, edges]);

  const stop = React.useCallback(() => {
    try { console.log('[FlowRunner] stop'); } catch { }
    setIsRunning(false);
    setQueue([]);
    setCurrentNodeId(null);
    setCurrentActIndex(0);
    setChat([]);
    setCurrentDDT(null);
    try { ddtReset(); } catch { }
    lastPromptKeyRef.current = '';
    prevMainIndexRef.current = -1;
    successTickRef.current = '';
    setInputText('');
  }, []);

  const resolveAct = React.useCallback((row: any) => {
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

  const actIsInteractive = React.useCallback((row: any) => {
    const it = resolveAct(row);
    const mode = it?.mode || (row as any)?.mode;
    return Boolean(it?.ddt || (mode && ['DataRequest', 'DataConfirmation'].includes(mode)));
  }, [resolveAct]);

  const actMessage = React.useCallback((row: any) => {
    const it: any = resolveAct(row);
    return (it?.prompts && (it.prompts.informal || it.prompts.formal)) || '';
  }, [resolveAct]);

  const drainSequentialNonInteractiveFrom = React.useCallback((startIndex: number) => {
    if (!currentNodeId) return false;
    const node = nodes.find(n => n.id === currentNodeId);
    const rows = (node?.data?.rows || []) as any[];
    const total = rows.length;
    let idx = startIndex;
    let emitted = false;
    try { console.log('[FlowRunner] drain start', { nodeId: currentNodeId, total, idx }); } catch { }
    while (idx < total && !actIsInteractive(rows[idx])) {
      const msg = actMessage(rows[idx]);
      if (msg) {
        emitted = true;
        try { console.log('[FlowRunner] emit non-interactive', { idx, msg }); } catch { }
        setChat(prev => [...prev, { role: 'agent', text: msg, interactive: false, fromDDT: false }]);
      }
      idx += 1;
    }
    if (idx !== startIndex) setCurrentActIndex(idx);
    if (idx < total && actIsInteractive(rows[idx])) {
      const it: any = resolveAct(rows[idx]);
      if (it?.ddt) {
        const assembled = toAssembled(it.ddt);
        try { console.log('[FlowRunner] mount DDT from drain', { actIndex: idx, ddtId: assembled?.id }); } catch { }
        setCurrentDDT(assembled);
        // Capture active context (block + act) for variable key composition
        try {
          const node = nodes.find(n => n.id === currentNodeId);
          const title = (node?.data as any)?.title || '';
          const blockIndex = Math.max(0, (nodes || []).findIndex(n => n.id === currentNodeId));
          const blockName = normalizeName(title) || `blocco${blockIndex + 1}`;
          const actName = normalizeName(it?.name || it?.label || rows[idx]?.text || 'act');
          setActiveContext({ blockName, actName });
        } catch { }
      }
    }
    try { console.log('[FlowRunner] drain end', { nextIndex: idx, emitted }); } catch { }
    return emitted;
  }, [currentNodeId, nodes, actIsInteractive, actMessage, resolveAct, toAssembled]);

  const drainSequentialNonInteractive = React.useCallback(() => {
    return drainSequentialNonInteractiveFrom(currentActIndex);
  }, [drainSequentialNonInteractiveFrom, currentActIndex]);

  const runCurrentAct = React.useCallback(() => {
    if (!currentNodeId) return;
    const node = nodes.find(n => n.id === currentNodeId);
    const rows = (node?.data?.rows || []) as any[];
    if (currentActIndex >= rows.length) return;
    // Drain consecutive non-interactive messages first
    const emitted = drainSequentialNonInteractive();
    if (!emitted) {
      // If nothing emitted, either we are on an interactive act (already mounted) or nothing to run
      const row = rows[currentActIndex];
      if (row && actIsInteractive(row)) {
        const it: any = resolveAct(row);
        if (it?.ddt) {
          const assembled = toAssembled(it.ddt); try { console.log('[FlowRunner] mount DDT (no drain)', { actIndex: currentActIndex, ddtId: assembled?.id }); } catch { } setCurrentDDT(assembled); try {
            const node = nodes.find(n => n.id === currentNodeId);
            const title = (node?.data as any)?.title || '';
            const blockIndex = Math.max(0, (nodes || []).findIndex(n => n.id === currentNodeId));
            const blockName = normalizeName(title) || `blocco${blockIndex + 1}`;
            const actName = normalizeName(it?.name || it?.label || row?.text || 'act');
            setActiveContext({ blockName, actName });
          } catch { }
        }
      }
    }
  }, [currentNodeId, currentActIndex, nodes, drainSequentialNonInteractive, actIsInteractive, resolveAct, toAssembled]);

  // Advance logic: after user presses Next Act or when simulator marks node complete (future)
  const nextAct = React.useCallback(() => {
    if (!currentNodeId) return;
    const node = nodes.find(n => n.id === currentNodeId);
    const total = (node?.data?.rows || []).length;
    // If we were on an interactive act, advance one then drain the next non-interactive sequence
    const nextIdx = currentActIndex + 1;
    if (nextIdx < total) {
      setCurrentActIndex(nextIdx);
      setCurrentDDT(null);
      // Drain immediately after moving (use computed index to avoid stale closure)
      setTimeout(() => { drainSequentialNonInteractiveFrom(nextIdx); }, 0);
    } else {
      // move to next node in graph (first outgoing for now)
      const nextIds = nextNodes(currentNodeId, edges);
      const first = nextIds[0];
      if (first) {
        setCurrentNodeId(first);
        setCurrentActIndex(0);
        setCurrentDDT(null);
        setTimeout(() => { drainSequentialNonInteractiveFrom(0); }, 0);
      } else {
        // finished branch; stop or pull next entry
        if (queue.length > 1) {
          const [, ...rest] = queue;
          setQueue(rest);
          setCurrentNodeId(rest[0] || null);
          setCurrentActIndex(0);
          setCurrentDDT(null);
          setTimeout(() => { drainSequentialNonInteractiveFrom(0); }, 0);
        } else {
          setIsRunning(false);
        }
      }
    }
  }, [currentNodeId, currentActIndex, nodes, edges, queue, drainSequentialNonInteractive]);

  // Auto-run non-interactive acts on Start
  React.useEffect(() => {
    if (!isRunning || !currentNodeId) return;
    try { console.log('[FlowRunner] effect start: drain initial', { nodeId: currentNodeId, isRunning }); } catch { }
    // At start, drain the initial non-interactive sequence (e.g., due messaggi)
    drainSequentialNonInteractive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, currentNodeId]);

  // DDT engine → append prompts into the unified chat
  const resolveTxt = React.useCallback((key?: string, localDict?: Record<string, string>): string => {
    if (!key) return '';
    if (/\s/.test(key) && !/^[\w.-]+\.[\w.-]+/.test(key)) return key;
    const merged: any = { ...(dataDialogueTranslations || {}), ...(localDict || {}) };
    const t = merged[key];
    return typeof t === 'string' && t.trim() ? t : key;
  }, [dataDialogueTranslations]);

  const ddtLocalTranslations = React.useMemo(() => ((currentDDT as any)?.translations && (((currentDDT as any).translations as any).en || (currentDDT as any).translations)) || {}, [currentDDT]);

  // Build a quick sub->main map for variable composition
  const subToMain = React.useMemo(() => {
    const map: Record<string, string> = {};
    try {
      Object.values(planById || {}).forEach((n: any) => {
        if (n && Array.isArray(n.subs)) {
          n.subs.forEach((sid: string) => { map[sid] = n.id; });
        }
      });
    } catch { }
    return map;
  }, [planById]);

  // Expose variables globally for ConditionEditor and other panels
  React.useEffect(() => {
    try { (window as any).__omniaVars = { ...(variableStore || {}) }; } catch { }
  }, [variableStore]);

  React.useEffect(() => {
    try { console.log('[FlowRunner] ddtActive', { ddtActive }); } catch { }
    if (ddtActive) {
      try { setTimeout(() => { inputRef.current?.focus({ preventScroll: true } as any); }, 0); } catch { }
    }
  }, [ddtActive]);

  React.useEffect(() => {
    if (!ddtActive) return;
    const plan = ddtState.plan;
    const currentMainId = plan?.order?.[ddtState.currentIndex];
    try { console.log('[FlowRunner][DDT] state', { mode: ddtState.mode, currentIndex: ddtState.currentIndex, currentMainId, currentSubId: ddtState.currentSubId }); } catch { }

    // Persist memory values into variable store
    try {
      const mem: any = (ddtState as any).memory || {};
      const ctx = activeContext;
      if (ctx) {
        const writes: Record<string, any> = {};
        Object.entries(mem).forEach(([id, entry]: any) => {
          if (!entry || entry.value === undefined) return;
          const node: any = planById[id];
          if (!node) return;
          if (node.type === 'main') {
            const mainKey = `${ctx.blockName}.${ctx.actName}.${normalizeName(node.label || node.name)}`;
            const v = stringifyValue(entry.value);
            writes[mainKey] = v;
          } else if (node.type === 'sub') {
            const mainId = subToMain[id];
            const mainNode: any = planById[mainId];
            const subKey = `${ctx.blockName}.${ctx.actName}.${normalizeName(mainNode?.label || mainNode?.name)}.${normalizeName(node.label || node.name)}`;
            const v = stringifyValue(entry.value);
            writes[subKey] = v;
          }
        });
        if (Object.keys(writes).length) {
          setVariableStore(prev => ({ ...prev, ...writes }));
          try { console.log('[FlowRunner][vars.write]', writes); } catch { }
        }
      }
    } catch { }

    // On main index change → ask next main
    if (ddtState.currentIndex !== prevMainIndexRef.current && currentMainId) {
      const mainAsk = resolveTxt(planById[currentMainId]?.steps?.ask?.base, ddtLocalTranslations as any);
      if (mainAsk) {
        const key = `main:${currentMainId}:ask`;
        if (lastPromptKeyRef.current !== key) {
          try { console.log('[FlowRunner][DDT] ask main', { currentMainId, text: mainAsk }); } catch { }
          setChat((m) => [...m, { role: 'agent', text: mainAsk, interactive: true, fromDDT: true }]);
          lastPromptKeyRef.current = key;
          prevMainIndexRef.current = ddtState.currentIndex;
          try { setTimeout(() => { inputRef.current?.focus({ preventScroll: true } as any); }, 0); } catch { }
        }
      }
    }

    // When entering CollectingSub → ask sub
    if (ddtState.mode === 'CollectingSub' && ddtState.currentSubId) {
      const subAsk = resolveTxt(planById[ddtState.currentSubId]?.steps?.ask?.base, ddtLocalTranslations as any);
      if (subAsk) {
        const key = `sub:${ddtState.currentSubId}:ask`;
        if (lastPromptKeyRef.current !== key) {
          try { console.log('[FlowRunner][DDT] ask sub', { subId: ddtState.currentSubId, text: subAsk }); } catch { }
          setChat((m) => [...m, { role: 'agent', text: subAsk, interactive: true, fromDDT: true }]);
          lastPromptKeyRef.current = key;
          try { setTimeout(() => { inputRef.current?.focus({ preventScroll: true } as any); }, 0); } catch { }
        }
      }
    }

    // Confirming main
    if (ddtState.mode === 'ConfirmingMain' && currentMainId) {
      const confirm = resolveTxt(planById[currentMainId]?.steps?.confirm?.base, ddtLocalTranslations as any);
      if (confirm) {
        const key = `main:${currentMainId}:confirm`;
        if (lastPromptKeyRef.current !== key) {
          // Resolve {input} from variable store or engine memory
          let resolved = confirm;
          try {
            const ctx = activeContext;
            const node: any = planById[currentMainId];
            const mem: any = (ddtState as any).memory || {};
            const mainLabel = normalizeName(node?.label || node?.name);
            let valueStr = '';
            if (ctx) {
              const fullKey = `${ctx.blockName}.${ctx.actName}.${mainLabel}`;
              valueStr = variableStore[fullKey] || '';
            }
            if (!valueStr) {
              const val = mem[currentMainId]?.value;
              valueStr = stringifyValue(val);
            }
            if (valueStr) resolved = resolved.replace('{input}', valueStr);
          } catch { }
          try { console.log('[FlowRunner][DDT] confirm main', { currentMainId, text: resolved }); } catch { }
          setChat((m) => [...m, { role: 'agent', text: resolved, interactive: true, fromDDT: true }]);
          lastPromptKeyRef.current = key;
          try { setTimeout(() => { inputRef.current?.focus({ preventScroll: true } as any); }, 0); } catch { }
        }
      }
    }

    // Success main → show success first message
    if (ddtState.mode === 'SuccessMain' && currentMainId) {
      const successArr = planById[currentMainId]?.steps?.success?.base || [];
      const success = Array.isArray(successArr) ? successArr[0] : undefined;
      const msg = resolveTxt(success, ddtLocalTranslations as any);
      if (msg) {
        const key = `main:${currentMainId}:success`;
        if (lastPromptKeyRef.current !== key) {
          try { console.log('[FlowRunner][DDT] success main', { currentMainId, text: msg }); } catch { }
          setChat((m) => [...m, { role: 'agent', text: msg, interactive: true, fromDDT: true }]);
          lastPromptKeyRef.current = key;
        }
      }
      // Auto advance on next tick: send empty input once from SuccessMain
      const tickKey = `${currentMainId}:${ddtState.currentIndex}`;
      if (successTickRef.current !== tickKey) {
        successTickRef.current = tickKey;
        try { console.log('[FlowRunner][DDT] success -> auto advance tick'); } catch { }
        setTimeout(() => { void ddtSend(''); }, 0);
      }
    }

    // Completed → advance flow (ignore spurious Completed right after mount/reset until ready)
    if (ddtState.mode === 'Completed') {
      if (!ddtReadyRef.current) {
        try { console.log('[FlowRunner][DDT] Completed ignored (engine not ready yet)'); } catch { }
        return;
      }
      try { console.log('[FlowRunner][DDT] completed → nextAct'); } catch { }
      // clear current DDT and advance to next act
      setCurrentDDT(null);
      lastPromptKeyRef.current = '';
      prevMainIndexRef.current = -1;
      successTickRef.current = '';
      setTimeout(() => { nextAct(); }, 0);
    }
  }, [ddtActive, ddtState, planById, ddtLocalTranslations, resolveTxt, nextAct]);

  // Seed the very first main ask immediately on DDT mount to avoid race with plan mapping
  React.useEffect(() => {
    if (!ddtActive) return;
    try {
      const nodes = (ddtTemplate?.nodes || []) as any[];
      const firstMain = nodes.find((n: any) => n?.type === 'main');
      const askKey = firstMain?.steps?.ask?.base;
      const text = resolveTxt(askKey, ddtLocalTranslations as any);
      const key = firstMain ? `main:${firstMain.id}:ask` : '';
      if (text && key && lastPromptKeyRef.current !== key) {
        console.log('[FlowRunner][DDT] seed ask main', { mainId: firstMain?.id, text });
        setChat((m) => [...m, { role: 'agent', text, interactive: true, fromDDT: true }]);
        lastPromptKeyRef.current = key;
        ddtReadyRef.current = true;
        // Mark first main index as already asked to avoid duplicate ask from state effect
        try { prevMainIndexRef.current = 0; } catch { }
      }
    } catch { }
  }, [ddtActive, ddtTemplate, resolveTxt, ddtLocalTranslations]);

  const onSend = React.useCallback(() => {
    const text = (inputText || '').trim();
    if (!text) return;
    try { console.log('[FlowRunner] user send', { text, ddtActive }); } catch { }
    setChat((m) => [...m, { role: 'user', text }]);
    setInputText('');
    if (ddtActive) {
      void ddtSend(text);
    }
    try { setTimeout(() => { inputRef.current?.focus({ preventScroll: true } as any); }, 0); } catch { }
  }, [inputText, ddtActive, ddtSend]);

  // Auto-scroll transcript to bottom on new messages
  React.useEffect(() => {
    try {
      const el = chatRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } catch { }
  }, [chat]);

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 8, height: '100%', overflowY: 'auto' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--sidebar-content-bg, #18181b)', border: '1px solid var(--sidebar-border, #334155)', borderRadius: 8, padding: '6px 10px' }}>
        <span style={{ fontWeight: 700, color: 'var(--sidebar-content-text, #f1f5f9)' }}>Debugger</span>
        <button
          onClick={() => {
            try {
              const ev: any = new CustomEvent('debugger:close', { bubbles: true });
              document.dispatchEvent(ev);
            } catch { }
          }}
          title="Chiudi"
          style={{ background: 'transparent', border: '1px solid var(--sidebar-border, #334155)', borderRadius: 6, padding: '4px 8px', color: 'var(--sidebar-content-text, #f1f5f9)' }}
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={isRunning ? stop : start} style={{ border: '1px solid #334155', borderRadius: 6, padding: '6px 10px', background: isRunning ? '#7f1d1d' : '#065f46', color: '#fff' }}>{isRunning ? 'Stop' : 'Start'}</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: '1fr auto', gap: 8 }}>
        <div ref={chatRef} style={{ overflowY: 'auto', border: '1px solid var(--sidebar-border, #334155)', borderRadius: 8, padding: 8 }}>
          {chat.length === 0 ? null : (
            chat.map((m, i) => (
              <div key={i} style={{ marginBottom: 6, color: m.role === 'user' ? '#ffffff' : (m.fromDDT ? '#38bdf8' : (m.interactive ? '#38bdf8' : '#22c55e')) }}>
                {m.text}
              </div>
            ))
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, border: '1px solid var(--sidebar-border, #334155)', borderRadius: 8, padding: 8 }}>
          <input
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            onFocus={() => { try { console.log('[FlowRunner][input] focus', { ddtActive }); } catch { } }}
            onBlur={() => { try { console.log('[FlowRunner][input] blur'); } catch { } }}
            placeholder={ddtActive ? 'Scrivi qui…' : 'In attesa di atto interattivo…'}
            style={{ flex: 1, border: '1px solid #334155', padding: 8, borderRadius: 6, background: 'transparent', color: 'var(--sidebar-content-text, #f1f5f9)' }}
          />
          <button onClick={onSend} disabled={!ddtActive || !inputText.trim()} style={{ border: '1px solid #334155', borderRadius: 6, padding: '6px 10px' }}>Invia</button>
        </div>
      </div>
    </div>
  );
}


