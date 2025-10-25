import React, { useState, useMemo, useEffect, useRef } from 'react';
import DDTWizard from '../../DialogueDataTemplateBuilder/DDTWizard/DDTWizard';
import { isDDTEmpty } from '../../../utils/ddt';
import { useDDTManager } from '../../../context/DDTManagerContext';
import Sidebar from './Sidebar';
import { Undo2, Redo2, Plus, MessageSquare, Code2, FileText, Rocket, BookOpen, Sparkles } from 'lucide-react';
import StepsStrip from './StepsStrip';
import StepEditor from './StepEditor';
import RightPanel, { useRightPanelWidth, RightPanelMode } from './RightPanel';
// import SynonymsEditor from './SynonymsEditor';
import NLPExtractorProfileEditor from './NLPExtractorProfileEditor';
import EditorHeader from '../../common/EditorHeader';
import { findAgentAct, getAgentActVisualsByType } from '../../Flowchart/utils/actVisuals';
import ActionDragLayer from './ActionDragLayer';
import {
  getMainDataList,
  getSubDataList,
  getNodeSteps
} from './ddtSelectors';

export default function ResponseEditor({ ddt, onClose, onWizardComplete, act }: { ddt: any, onClose?: () => void, onWizardComplete?: (finalDDT: any) => void, act?: { id: string; type: string; label?: string } }) {
  // Font zoom (Ctrl+wheel) like sidebar
  const MIN_FONT_SIZE = 12;
  const MAX_FONT_SIZE = 24;
  const DEFAULT_FONT_SIZE = 16;
  const [fontSize, setFontSize] = useState<number>(DEFAULT_FONT_SIZE);
  const rootRef = useRef<HTMLDivElement>(null);
  const fontScale = useMemo(() => Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, fontSize)) / DEFAULT_FONT_SIZE, [fontSize]);

  // Helper: enforce phone kind by label when missing/mis-set
  const coercePhoneKind = (src: any) => {
    if (!src) return src;
    const clone = JSON.parse(JSON.stringify(src));
    try {
      const mains = Array.isArray(clone?.mainData) ? clone.mainData : [];
      const before = mains.map((m: any) => ({ label: m?.label, kind: (m?.kind || '').toString(), manual: (m as any)?._kindManual }));
      for (const m of mains) {
        const label = String(m?.label || '').toLowerCase();
        if (/phone|telephone|tel|cellulare|mobile/.test(label)) {
          if ((m?.kind || '').toLowerCase() !== 'phone') {
            m.kind = 'phone';
            (m as any)._kindManual = 'phone';
          }
        }
      }
      const after = mains.map((m: any) => ({ label: m?.label, kind: (m?.kind || '').toString(), manual: (m as any)?._kindManual }));
      try { console.log('[KindPersist][ResponseEditor][coercePhoneKind]', { before, after }); } catch { }
    } catch { }
    return clone;
  };
  // Local editable copies (initialize with coerced phone kind)
  const [localDDT, setLocalDDT] = useState<any>(() => coercePhoneKind(ddt));
  const { ideTranslations, dataDialogueTranslations, replaceSelectedDDT } = useDDTManager();
  // Debug logger gated by localStorage flag: set localStorage.setItem('debug.responseEditor','1') to enable
  const log = (...args: any[]) => {
    try { if (localStorage.getItem('debug.responseEditor') === '1') console.log(...args); } catch { }
  };
  // Ensure debug flag is set once to avoid asking again
  useEffect(() => {
    try { localStorage.setItem('debug.responseEditor', '1'); } catch { }
    try { localStorage.setItem('debug.reopen', '1'); } catch { }
  }, []);
  const mergedBase = useMemo(() => ({ ...(ideTranslations || {}), ...(dataDialogueTranslations || {}) }), [ideTranslations, dataDialogueTranslations]);
  const [localTranslations, setLocalTranslations] = useState<any>({ ...mergedBase, ...((ddt?.translations && (ddt.translations.en || ddt.translations)) || {}) });

  // --- Helpers: preserve/ensure steps on reopen (UI-only; no persistence) ---
  function ensureStepsForNode(node: any): any {
    if (!node) return node;
    const steps = node.steps;
    // If steps exist in either object or array form, leave unchanged
    if (steps && (Array.isArray(steps) ? steps.length > 0 : Object.keys(steps || {}).length > 0)) return node;
    const messages = node.messages || {};
    const stepKeys = Object.keys(messages || {});
    if (stepKeys.length === 0) return node;
    // Build minimal steps object: one escalation with sayMessage(textKey)
    const built: any = {};
    for (const k of stepKeys) {
      const textKey = messages[k]?.textKey;
      built[k] = {
        escalations: [
          {
            actions: [
              {
                actionId: 'sayMessage',
                parameters: textKey ? [{ parameterId: 'text', value: textKey }] : [],
              }
            ],
          }
        ],
      };
    }
    return { ...node, steps: built };
  }

  function preserveStepsFromPrev(prev: any, next: any): any {
    if (!prev || !next) return next;
    const prevMains = Array.isArray(prev?.mainData) ? prev.mainData : [];
    const nextMains = Array.isArray(next?.mainData) ? next.mainData : [];
    const mapByLabel = (arr: any[]) => {
      const m = new Map<string, any>();
      arr.forEach((n: any) => { if (n?.label) m.set(String(n.label), n); });
      return m;
    };
    const prevMap = mapByLabel(prevMains);
    const enrichedMains = nextMains.map((n: any) => {
      const prevNode = prevMap.get(String(n?.label));
      let merged = n;
      if (prevNode && !n?.steps && prevNode?.steps) merged = { ...n, steps: prevNode.steps };
      const subs = Array.isArray(n?.subData) ? n.subData : [];
      const prevSubs = Array.isArray(prevNode?.subData) ? prevNode.subData : [];
      const prevSubsMap = mapByLabel(prevSubs);
      const mergedSubs = subs.map((s: any) => {
        const prevS = prevSubsMap.get(String(s?.label));
        if (prevS && !s?.steps && prevS?.steps) return { ...ensureStepsForNode(s), steps: prevS.steps };
        return ensureStepsForNode(s);
      });
      return { ...ensureStepsForNode(merged), subData: mergedSubs };
    });
    return { ...next, mainData: enrichedMains };
  }

  useEffect(() => {
    // Don't sync from prop if wizard owns the data
    if (wizardOwnsDataRef.current) {
      return;
    }

    const prevId = (localDDT && (localDDT.id || localDDT._id)) as any;
    const nextId = (ddt && (ddt.id || ddt._id)) as any;
    const isSameDDT = prevId && nextId && prevId === nextId;
    const coerced = coercePhoneKind(ddt);

    // Sync ONLY if it's a different DDT (ID changed) or first load
    const shouldSync = !prevId || !nextId || !isSameDDT;

    if (shouldSync && localDDT !== coerced) {
      try {
        const mainsBefore = Array.isArray((localDDT || {}).mainData) ? (localDDT as any).mainData.map((m: any) => ({ label: m?.label, kind: m?.kind, manual: (m as any)?._kindManual })) : [];
        const mainsAfter = Array.isArray((coerced || {}).mainData) ? (coerced as any).mainData.map((m: any) => ({ label: m?.label, kind: m?.kind, manual: (m as any)?._kindManual })) : [];
        console.log('[KindPersist][ResponseEditor][loadDDT->setLocalDDT]', { mainsBefore, mainsAfter });
      } catch { }
      // Preserve steps from previous in-memory DDT when reopening same template; ensure steps from messages if missing
      const enriched = preserveStepsFromPrev(localDDT, coerced);
      setLocalDDT(enriched);
    }
    const nextTranslations = { ...mergedBase, ...((ddt?.translations && (ddt.translations.en || ddt.translations)) || {}) };
    setLocalTranslations((prev: any) => {
      const same = JSON.stringify(prev) === JSON.stringify(nextTranslations);
      return same ? prev : nextTranslations;
    });
    // Reset selection when a different DDT is opened (new session)
    if (!isSameDDT) {
      setSelectedMainIndex(0);
      setSelectedSubIndex(undefined);
    }
    try {
      const counts = {
        ide: ideTranslations ? Object.keys(ideTranslations).length : 0,
        data: dataDialogueTranslations ? Object.keys(dataDialogueTranslations).length : 0,
        ddt: ddt?.translations?.en ? Object.keys(ddt.translations.en).length : (ddt?.translations ? Object.keys(ddt.translations).length : 0),
        merged: localTranslations ? Object.keys(localTranslations).length : 0,
      };
      log('[ResponseEditor] Translation sources counts:', counts);
      log('[ResponseEditor][DDT load]', { prevId, nextId, isSameDDT, selectedMainIndex, selectedSubIndex });
      const mains = getMainDataList(ddt) || [];
      log('[ResponseEditor] DDT label:', ddt?.label, 'mains:', mains.map((m: any) => m?.label));
    } catch { }
    // include localDDT in deps to compare ids; avoid resetting selection for same DDT updates
  }, [ddt, mergedBase, localDDT?.id, localDDT?._id]);

  // Note: do not persist on unmount to avoid re-opening the editor after close.

  const mainList = useMemo(() => getMainDataList(localDDT), [localDDT]);
  // Aggregated view: show a group header when there are multiple mains
  const isAggregatedAtomic = useMemo(() => (
    Array.isArray(mainList) && mainList.length > 1
  ), [mainList]);
  const [selectedMainIndex, setSelectedMainIndex] = useState(0);
  const [selectedSubIndex, setSelectedSubIndex] = useState<number | undefined>(undefined);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [rightMode, setRightMode] = useState<RightPanelMode>('actions'); // Always start with actions panel visible
  const { width: rightWidth, setWidth: setRightWidth } = useRightPanelWidth(360);
  const [dragging, setDragging] = useState(false);
  const [showSynonyms, setShowSynonyms] = useState(false);
  // Wizard/general layout flags
  const [showWizard, setShowWizard] = useState<boolean>(() => isDDTEmpty(localDDT));
  const wizardOwnsDataRef = useRef(false); // Flag: wizard has control over data lifecycle

  // Header: icon, title, and toolbar
  const actType = (act?.type || 'DataRequest') as any;
  const { Icon, color: iconColor } = getAgentActVisualsByType(actType,  !!localDDT);
  // Priority: _sourceAct.label (preserved act info) > act.label (direct prop) > localDDT._userLabel (legacy) > generic fallback
  // NOTE: Do NOT use localDDT.label here - that's the DDT root label (e.g. "Age") which belongs in the TreeView, not the header
  const sourceAct = (localDDT as any)?._sourceAct;
  const headerTitle = sourceAct?.label || act?.label || (localDDT as any)?._userLabel || 'Response Editor';

  const saveRightMode = (m: RightPanelMode) => {
    setRightMode(m);
    try { localStorage.setItem('responseEditor.rightMode', m); } catch { }
  };

  // Toolbar buttons (empty during wizard, full after)
  const toolbarButtons = !showWizard ? [
    { icon: <Undo2 size={16} />, onClick: () => { }, title: "Undo" },
    { icon: <Redo2 size={16} />, onClick: () => { }, title: "Redo" },
    { icon: <Plus size={16} />, label: "Add constraint", onClick: () => { }, primary: true },
    { icon: <Rocket size={16} />, onClick: () => { setShowSynonyms(false); saveRightMode('actions'); }, title: "Actions", active: rightMode === 'actions' },
    { icon: <Code2 size={16} />, onClick: () => { setShowSynonyms(false); saveRightMode('validator'); }, title: "Validator", active: rightMode === 'validator' },
    { icon: <FileText size={16} />, onClick: () => { setShowSynonyms(false); saveRightMode('testset'); }, title: "Test set", active: rightMode === 'testset' },
    { icon: <MessageSquare size={16} />, onClick: () => { setShowSynonyms(false); saveRightMode('chat'); }, title: "Chat", active: rightMode === 'chat' },
    { icon: <Sparkles size={16} />, onClick: () => { setShowSynonyms(false); saveRightMode('styles'); }, title: "Dialogue style presets", active: rightMode === 'styles' },
    { icon: <BookOpen size={16} />, onClick: () => setShowSynonyms(v => !v), title: showSynonyms ? 'Close contract editor' : 'Open contract editor', active: showSynonyms },
  ] : [];

  useEffect(() => {
    const empty = isDDTEmpty(localDDT);

    if (empty && !wizardOwnsDataRef.current) {
      // DDT is empty → open wizard and take ownership
      setShowWizard(true);
      wizardOwnsDataRef.current = true;
    } else if (!empty && wizardOwnsDataRef.current) {
      // DDT is complete and wizard had ownership → close wizard and release ownership
      setShowWizard(false);
      wizardOwnsDataRef.current = false;
    }
  }, [localDDT]);

  // Nodo selezionato: sempre main/sub in base agli indici
  const selectedNode = useMemo(() => {
    const main = mainList[selectedMainIndex];
    if (!main) {
      return null;
    }
    if (selectedSubIndex == null) return main;
    const subList = getSubDataList(main);
    const sub = subList[selectedSubIndex] || main;
    return sub;
  }, [mainList, selectedMainIndex, selectedSubIndex]);

  // Step keys per il nodo selezionato
  const stepKeys = useMemo(() => selectedNode ? getNodeSteps(selectedNode) : [], [selectedNode]);
  // Append V2 notConfirmed for main node if present
  const uiStepKeys = useMemo(() => {
    if (selectedSubIndex != null) return stepKeys;
    if (!stepKeys.includes('notConfirmed')) return [...stepKeys, 'notConfirmed'];
    return stepKeys;
  }, [stepKeys, selectedSubIndex]);
  const [selectedStepKey, setSelectedStepKey] = useState<string>('');

  // Mantieni lo step selezionato quando cambia il dato. Se lo step non esiste per il nuovo dato, fallback al primo disponibile.
  React.useEffect(() => {
    if (!stepKeys.length) { setSelectedStepKey(''); return; }
    if (selectedStepKey && stepKeys.includes(selectedStepKey)) return;
    // Prefer default 'start' if present, otherwise first available
    const preferred = stepKeys.includes('start') ? 'start' : stepKeys[0];
    setSelectedStepKey(preferred);
  }, [stepKeys, selectedStepKey]);

  // Snapshot log su cambio selezione (abilita con localStorage.setItem('debug.reopen','1'))
  React.useEffect(() => {
    try {
      if (localStorage.getItem('debug.reopen') === '1') {
        // Selection changed, could track analytics here if needed
      }
    } catch { }
  }, [mainList, selectedMainIndex, selectedSubIndex, selectedStepKey, stepKeys]);

  // Callback per Sidebar
  const handleSelectMain = (idx: number) => {
    setSelectedMainIndex(idx);
    setSelectedSubIndex(undefined);
    setTimeout(() => { sidebarRef.current?.focus(); }, 0);
  };

  // Callback per Header
  // removed unused header handler
  const handleSelectSub = (idx: number | undefined) => {
    setSelectedSubIndex(idx);
    setTimeout(() => { sidebarRef.current?.focus(); }, 0);
  };

  // Editing helpers
  const updateSelectedNode = (updater: (node: any) => any) => {
    setLocalDDT((prev: any) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev));
      const mains = getMainDataList(next);
      const main = mains[selectedMainIndex];
      if (!main) return prev;
      const beforeKind = selectedSubIndex == null ? main?.kind : getSubDataList(main)[selectedSubIndex]?.kind;
      if (selectedSubIndex == null) {
        const before = JSON.stringify(main);
        const updated = updater(main) || main;
        const after = JSON.stringify(updated);
        if (before === after) return prev; // no content change
        mains[selectedMainIndex] = updated;
      } else {
        const subList = getSubDataList(main);
        const sub = subList[selectedSubIndex];
        if (!sub) return prev;
        const subIdx = (main.subData || []).findIndex((s: any) => s.label === sub.label);
        const before = JSON.stringify(main.subData[subIdx]);
        const updated = updater(sub) || sub;
        const after = JSON.stringify(updated);
        if (before === after) return prev; // no content change
        main.subData[subIdx] = updated;
      }
      next.mainData = mains;
      try {
        const afterMain = mains[selectedMainIndex];
        const afterKind = selectedSubIndex == null ? afterMain?.kind : getSubDataList(afterMain)[selectedSubIndex]?.kind;
        log('[ResponseEditor][updateSelectedNode]', {
          mainLabel: afterMain?.label,
          selectedMainIndex,
          selectedSubIndex,
          beforeKind,
          afterKind,
        });
        try {
          const mainsKinds = (getMainDataList(next) || []).map((m: any) => ({ label: m?.label, kind: m?.kind, manual: (m as any)?._kindManual }));
          console.log('[KindPersist][ResponseEditor][updateSelectedNode->replaceSelectedDDT]', mainsKinds);
        } catch { }
      } catch { }
      try { replaceSelectedDDT(next); } catch { }
      return next;
    });
  };

  // kept for future translation edits in StepEditor

  // Splitter drag handlers
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const total = window.innerWidth;
      const leftMin = 320;
      const minRight = 160;
      const maxRight = Math.max(minRight, total - leftMin);
      const newWidth = Math.max(minRight, Math.min(maxRight, total - e.clientX));
      setRightWidth(newWidth);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, setRightWidth]);

  // Funzione per capire se c'├¿ editing attivo (input, textarea, select)
  function isEditingActive() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el as HTMLElement).tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable;
  }

  // Handler tastiera globale per step navigation
  const handleGlobalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (sidebarRef.current && document.activeElement === sidebarRef.current && !isEditingActive()) {
      if (e.key === 'ArrowRight') {
        const idx = stepKeys.indexOf(selectedStepKey);
        if (idx >= 0 && idx < stepKeys.length - 1) {
          setSelectedStepKey(stepKeys[idx + 1]);
          e.preventDefault();
          e.stopPropagation();
        }
      } else if (e.key === 'ArrowLeft') {
        const idx = stepKeys.indexOf(selectedStepKey);
        if (idx > 0) {
          setSelectedStepKey(stepKeys[idx - 1]);
          e.preventDefault();
          e.stopPropagation();
        }
      }
    }
  };

  const handleWheelFontZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
      e.preventDefault();
      setFontSize(prev => {
        const next = prev + (e.deltaY < 0 ? 1 : -1);
        return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, next));
      });
    }
  };

  // Attach non-passive wheel listener to block browser zoom and adjust only editor font
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const onWheel = (ev: WheelEvent) => {
      if (ev.ctrlKey) {
        ev.preventDefault();
        setFontSize(prev => {
          const next = prev + (ev.deltaY < 0 ? 1 : -1);
          return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, next));
        });
      }
    };
    node.addEventListener('wheel', onWheel, { passive: false } as any);
    return () => node.removeEventListener('wheel', onWheel as any);
  }, []);

  // Layout
  return (
    <div ref={rootRef} style={{ height: '100%', background: '#0b0f17', display: 'flex', flexDirection: 'column', fontSize: `${fontSize}px`, zoom: fontScale as unknown as string }} onKeyDown={handleGlobalKeyDown} onWheel={handleWheelFontZoom}>

      {/* Header sempre visibile (minimale durante wizard, completo dopo) */}
      <EditorHeader
        icon={<Icon size={18} style={{ color: iconColor }} />}
        title={headerTitle}
        toolbarButtons={toolbarButtons}
        onClose={onClose}
        color="orange"
      />

      {/* Contenuto */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {showWizard ? (
          /* Full-screen wizard without RightPanel */
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <DDTWizard
              initialDDT={localDDT}
              onCancel={onClose || (() => { })}
              onComplete={(finalDDT) => {
                const coerced = coercePhoneKind(finalDDT);

                // If parent provided onWizardComplete, delegate to it (DDTHostAdapter case)
                if (onWizardComplete) {
                  onWizardComplete(coerced);
                  return;
                }

                // Otherwise, handle locally (direct DDTManager case)
                // Set flag to prevent auto-reopen
                wizardOwnsDataRef.current = true;

                setLocalDDT(coerced);
                try { replaceSelectedDDT(coerced); } catch { }

                // Release ownership after a brief delay
                setTimeout(() => {
                  wizardOwnsDataRef.current = false;
                }, 100);

                // Close wizard and reset UI to show StepEditor (not MessageReview)
                setShowWizard(false);
                setRightMode('actions'); // Force show ActionList
                setSelectedStepKey('start'); // Start with first step
              }}
              startOnStructure={false}
            />
          </div>
        ) : (
          /* Normal editor layout with 3 panels (no header, already shown above) */
          <>
            {/* Always visible left navigation */}
            <Sidebar
              ref={sidebarRef}
              mainList={mainList}
              selectedMainIndex={selectedMainIndex}
              onSelectMain={handleSelectMain}
              selectedSubIndex={selectedSubIndex}
              onSelectSub={handleSelectSub}
              aggregated={isAggregatedAtomic}
              rootLabel={localDDT?.label || 'Data'}
              onChangeSubRequired={(mIdx: number, sIdx: number, required: boolean) => {
                // Persist required flag on the exact sub (by indices), independent of current selection
                setLocalDDT((prev: any) => {
                  if (!prev) return prev;
                  const next = JSON.parse(JSON.stringify(prev));
                  const mains = getMainDataList(next);
                  const main = mains[mIdx];
                  if (!main) return prev;
                  const subList = Array.isArray(main.subData) ? main.subData : [];
                  if (sIdx < 0 || sIdx >= subList.length) return prev;
                  subList[sIdx] = { ...subList[sIdx], required };
                  main.subData = subList;
                  mains[mIdx] = main;
                  next.mainData = mains;
                  try {
                    const subs = getSubDataList(main) || [];
                    const target = subs[sIdx];
                    if (localStorage.getItem('debug.responseEditor') === '1') console.log('[DDT][subRequiredToggle][persist]', { main: main?.label, label: target?.label, required });
                  } catch { }
                  try { replaceSelectedDDT(next); } catch { }
                  return next;
                });
              }}
              onReorderSub={(mIdx: number, fromIdx: number, toIdx: number) => {
                setLocalDDT((prev: any) => {
                  if (!prev) return prev;
                  const next = JSON.parse(JSON.stringify(prev));
                  const mains = getMainDataList(next);
                  const main = mains[mIdx];
                  if (!main) return prev;
                  const subList = Array.isArray(main.subData) ? main.subData : [];
                  if (fromIdx < 0 || fromIdx >= subList.length || toIdx < 0 || toIdx >= subList.length) return prev;
                  const [moved] = subList.splice(fromIdx, 1);
                  subList.splice(toIdx, 0, moved);
                  main.subData = subList;
                  mains[mIdx] = main;
                  next.mainData = mains;
                  try { if (localStorage.getItem('debug.responseEditor') === '1') console.log('[DDT][subReorder][persist]', { main: main?.label, fromIdx, toIdx }); } catch { }
                  try { replaceSelectedDDT(next); } catch { }
                  return next;
                });
              }}
              onAddMain={(label: string) => {
                setLocalDDT((prev: any) => {
                  if (!prev) return prev;
                  const next = JSON.parse(JSON.stringify(prev));
                  const mains = getMainDataList(next);
                  mains.push({ label, subData: [] });
                  next.mainData = mains;
                  try { replaceSelectedDDT(next); } catch { }
                  return next;
                });
              }}
              onRenameMain={(mIdx: number, label: string) => {
                setLocalDDT((prev: any) => {
                  if (!prev) return prev;
                  const next = JSON.parse(JSON.stringify(prev));
                  const mains = getMainDataList(next);
                  if (!mains[mIdx]) return prev;
                  mains[mIdx].label = label;
                  next.mainData = mains;
                  try { replaceSelectedDDT(next); } catch { }
                  return next;
                });
              }}
              onDeleteMain={(mIdx: number) => {
                setLocalDDT((prev: any) => {
                  if (!prev) return prev;
                  const next = JSON.parse(JSON.stringify(prev));
                  const mains = getMainDataList(next);
                  if (mIdx < 0 || mIdx >= mains.length) return prev;
                  mains.splice(mIdx, 1);
                  next.mainData = mains;
                  try { replaceSelectedDDT(next); } catch { }
                  return next;
                });
              }}
              onAddSub={(mIdx: number, label: string) => {
                setLocalDDT((prev: any) => {
                  if (!prev) return prev;
                  const next = JSON.parse(JSON.stringify(prev));
                  const mains = getMainDataList(next);
                  const main = mains[mIdx];
                  if (!main) return prev;
                  const list = Array.isArray(main.subData) ? main.subData : [];
                  list.push({ label, required: true });
                  main.subData = list;
                  mains[mIdx] = main;
                  next.mainData = mains;
                  try { replaceSelectedDDT(next); } catch { }
                  return next;
                });
              }}
              onRenameSub={(mIdx: number, sIdx: number, label: string) => {
                setLocalDDT((prev: any) => {
                  if (!prev) return prev;
                  const next = JSON.parse(JSON.stringify(prev));
                  const mains = getMainDataList(next);
                  const main = mains[mIdx];
                  if (!main) return prev;
                  const list = Array.isArray(main.subData) ? main.subData : [];
                  if (sIdx < 0 || sIdx >= list.length) return prev;
                  list[sIdx] = { ...(list[sIdx] || {}), label };
                  main.subData = list;
                  mains[mIdx] = main;
                  next.mainData = mains;
                  try { replaceSelectedDDT(next); } catch { }
                  return next;
                });
              }}
              onDeleteSub={(mIdx: number, sIdx: number) => {
                setLocalDDT((prev: any) => {
                  if (!prev) return prev;
                  const next = JSON.parse(JSON.stringify(prev));
                  const mains = getMainDataList(next);
                  const main = mains[mIdx];
                  if (!main) return prev;
                  const list = Array.isArray(main.subData) ? main.subData : [];
                  if (sIdx < 0 || sIdx >= list.length) return prev;
                  list.splice(sIdx, 1);
                  main.subData = list;
                  mains[mIdx] = main;
                  next.mainData = mains;
                  try { replaceSelectedDDT(next); } catch { }
                  return next;
                });
              }}
              onSelectAggregator={() => { setSelectedMainIndex(0); setSelectedSubIndex(undefined); setTimeout(() => { sidebarRef.current?.focus(); }, 0); }}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {/* Steps toolbar hidden during NLP editor */}
              {!showSynonyms && (
                <div style={{ borderBottom: '1px solid #1f2340', background: '#0f1422' }}>
                  <StepsStrip
                    stepKeys={uiStepKeys}
                    selectedStepKey={selectedStepKey}
                    onSelectStep={setSelectedStepKey}
                    node={selectedNode}
                  />
                </div>
              )}
              {/* Content */}
              <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: '16px 16px 0 16px' }}>
                  <div style={{ flex: 1, minHeight: 0, background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #e0d7f7', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                      {showSynonyms ? (
                        <div style={{ padding: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 8 }}>
                            <h4 style={{ margin: 0 }}>Data Extractor: {selectedNode?.label || ''}</h4>
                          </div>
                          <NLPExtractorProfileEditor
                            node={selectedNode}
                            locale={'it-IT'}
                            onChange={(profile) => {
                              // Always log critical kind changes to diagnose persistence
                              console.log('[KindChange][onChange]', {
                                nodeLabel: (selectedNode as any)?.label,
                                profileKind: profile?.kind,
                                examples: (profile?.examples || []).length,
                              });
                              updateSelectedNode((node) => {
                                const next: any = { ...(node || {}), nlpProfile: profile };
                                if (profile.kind && profile.kind !== 'auto') { next.kind = profile.kind; (next as any)._kindManual = profile.kind; }
                                if (Array.isArray(profile.synonyms)) next.synonyms = profile.synonyms;
                                return next;
                              });
                            }}
                          />
                        </div>
                      ) : (
                        <StepEditor
                          node={selectedNode}
                          stepKey={selectedStepKey}
                          translations={localTranslations}
                          onDeleteEscalation={(idx) => updateSelectedNode((node) => {
                            const next = { ...(node || {}), steps: { ...(node?.steps || {}) } };
                            const st = next.steps[selectedStepKey] || { type: selectedStepKey, escalations: [] };
                            st.escalations = (st.escalations || []).filter((_: any, i: number) => i !== idx);
                            next.steps[selectedStepKey] = st;
                            return next;
                          })}
                          onDeleteAction={(escIdx, actionIdx) => updateSelectedNode((node) => {
                            const next = { ...(node || {}), steps: { ...(node?.steps || {}) } };
                            const st = next.steps[selectedStepKey] || { type: selectedStepKey, escalations: [] };
                            const esc = (st.escalations || [])[escIdx];
                            if (!esc) return next;
                            esc.actions = (esc.actions || []).filter((_: any, j: number) => j !== actionIdx);
                            st.escalations[escIdx] = esc;
                            next.steps[selectedStepKey] = st;
                            return next;
                          })}
                        />
                      )}
                    </div>
                  </div>
                </div>
                {!showSynonyms && (
                  <RightPanel
                    mode={rightMode}
                    width={rightWidth}
                    onWidthChange={setRightWidth}
                    onStartResize={() => setDragging(true)}
                    dragging={dragging}
                    ddt={localDDT}
                    translations={localTranslations}
                    selectedNode={selectedNode}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Drag layer for visual feedback when dragging actions */}
      <ActionDragLayer />
    </div>
  );
}