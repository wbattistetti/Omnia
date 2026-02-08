import React from 'react';
import { getDDTIcon as getDDTIconFromRE } from '../TaskEditor/ResponseEditor/ddtUtils';
// ✅ REFACTOR: AI functions now in ConditionAIService
import ConditionTester, { CaseRow } from './ConditionTester';
import CodeEditor, { CodeEditorRef } from '../CodeEditor/CodeEditor';
import * as monacoNS from 'monaco-editor';
import { setMonacoMarkers, clearMonacoMarkers } from '../../utils/monacoMarkers';
import { X, Pencil, Check, Code2, FlaskConical, ListChecks, Loader2 } from 'lucide-react';
import { SIDEBAR_ICON_COMPONENTS, SIDEBAR_TYPE_ICONS } from '../Sidebar/sidebarTheme';
import { setupMonacoEnvironment } from '../../utils/monacoWorkerSetup';
import VariablesPanel from './VariablesPanel';
import { useAIProvider } from '../../context/AIProviderContext';
import { useProjectData, useProjectDataUpdate } from '../../context/ProjectDataContext';
import { convertScriptGuidsToLabels, convertScriptLabelsToGuids } from '../../utils/conditionScriptConverter';
// SmartTooltip is used only in the tester's toolbar (right panel)

// Ensure Monaco workers configured once
try { setupMonacoEnvironment(); } catch {}

type VarsMap = Record<string, any>;

type VarsTreeSub = { label: string; kind?: string };
type VarsTreeMain = { label: string; kind?: string; subs: VarsTreeSub[] };
type VarsTreeAct = { label: string; color?: string; Icon?: any; mains: VarsTreeMain[] };

interface Props {
  open: boolean;
  onClose: () => void;
  variables: VarsMap; // full variables map; shown as list
  initialScript?: string;
  dockWithinParent?: boolean;
  variablesTree?: VarsTreeAct[];
  label?: string;
  onRename?: (next: string) => void;
}

// ✅ REFACTOR: Use domain function
import { listKeys, flattenVariablesTree, filterVariablesTree, findDuplicateGroups, extractUsedVariables, filterVariablesForTester } from './domain/variablesDomain';
import { normalizeCode, parseTemplate, synthesizeDateVariables, fixDateAliases } from './domain/scriptDomain';
import { ConditionAIService } from './application/ConditionAIService';
import { ScriptManagerService } from './application/ScriptManagerService';
import { VariablesIntellisenseService } from './application/VariablesIntellisenseService';
import { useConditionEditorState } from './hooks/useConditionEditorState';

// No local template; EditorPanel injects the scaffold

export default function ConditionEditor({ open, onClose, variables, initialScript, dockWithinParent, variablesTree, label, onRename }: Props) {
  const [nl, setNl] = React.useState('');
  const DEFAULT_CODE = [
    '// Describe below, in detail, when the condition should be TRUE.',
    '// You can write pseudo-code or a plain natural-language description.',
    '// Right-click to view and insert the available variables the code must use.',
    '//',
    '// Example of pseudo-code for the condition "USER MUST BE ADULT":',
    '// PSEUDO-CODE:',
    '// Now - vars["Agent asks for user\'s name.DateOfBirth"] > 18 years',
    ''
  ].join('\n');

  // ✅ REFACTOR: Use centralized state hook
  const state = useConditionEditorState({
    open,
    initialScript,
    label,
    defaultCode: DEFAULT_CODE,
  });

  const {
    script, setScript,
    lastAcceptedScript, setLastAcceptedScript,
    hasCreated, setHasCreated,
    busy, setBusy,
    aiQuestion, setAiQuestion,
    showCode, setShowCode,
    showTester, setShowTester,
    showVariablesPanel, setShowVariablesPanel,
    isEditingTitle, setIsEditingTitle,
    titleValue, setTitleValue,
    headerHover, setHeaderHover,
    titleInputPx, setTitleInputPx,
    heightPx, setHeightPx,
    wVars, setWVars,
    wTester, setWTester,
    fontPx, setFontPx,
    selectedVars, setSelectedVars,
    testRows, setTestRows,
    testerHints, setTesterHints,
    testerAllPass, setTesterAllPass,
    hasFailures, setHasFailures,
    pendingDupGroups, setPendingDupGroups,
    preferredVarByTail, setPreferredVarByTail,
  } = state;

  // Use context directly - much simpler!
  let projectData: any = null;
  let pdUpdate: any = null;
  try {
    projectData = useProjectData().data;
    pdUpdate = useProjectDataUpdate();
  } catch {
    // Provider not available - skip
  }

  // ✅ REFACTOR: Use ScriptManagerService
  const scriptManager = React.useMemo(() => {
    return new ScriptManagerService({ projectData, pdUpdate });
  }, [projectData, pdUpdate]);

  const updateProjectDataScript = React.useCallback((scriptToSave: string) => {
    scriptManager.saveScript(scriptToSave, label || '');
  }, [scriptManager, label]);

  // Refs
  const monacoEditorRef = React.useRef<any>(null);
  const monacoInstanceRef = React.useRef<typeof monacoNS | null>(null);
  const codeEditorRef = React.useRef<CodeEditorRef>(null);
  React.useEffect(() => { try { monacoInstanceRef.current = (window as any).monaco || null; } catch {} }, []);
  const [runtimeErrorMsg, setRuntimeErrorMsg] = React.useState<string | null>(null);
  const varsKeys = React.useMemo(() => listKeys(variables), [variables]);
  const nlCERef = React.useRef<HTMLDivElement>(null);
  const scriptRef = React.useRef<HTMLTextAreaElement>(null);
  const scriptCaretRef = React.useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const titleMeasureRef = React.useRef<HTMLSpanElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Title width measurement
  const measureTitleWidth = React.useCallback((text: string) => {
    try {
      const el = titleMeasureRef.current;
      if (!el) return 200;
      el.textContent = text || '';
      const w = Math.ceil(el.offsetWidth || 0);
      return Math.max(160, Math.min(720, w + 24));
    } catch { return 200; }
  }, []);
  React.useEffect(() => {
    if (!isEditingTitle) return;
    setTitleInputPx(measureTitleWidth(titleValue));
  }, [isEditingTitle, titleValue, measureTitleWidth]);
  // chat removed
  // Use global AI provider from context
  const { provider } = useAIProvider();

  // ✅ REFACTOR: Initialize AI service
  const aiService = React.useMemo(() => {
    return new ConditionAIService();
  }, []);

  // ✅ REFACTOR: State reset is now handled in useConditionEditorState hook
  // Reset tester refs when opening
  React.useEffect(() => {
    if (!open) return;
    try {
      getFailuresRef.current = () => [];
      hasFailuresRef.current = () => false;
      resetTesterVisualsRef.current = () => {};
      markNotesAsUsedRef.current = () => {};
    } catch {}
  }, [open]);

  // Capture Ctrl+Wheel at window (capture phase) but scope it to ConditionEditor bounds
  React.useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      if (!inside) return;
      e.preventDefault();
      e.stopPropagation();
      setFontPx(prev => Math.min(24, Math.max(10, prev + (e.deltaY < 0 ? 1 : -1))));
    };
    window.addEventListener('wheel', onWheel, { passive: false, capture: true } as any);
    return () => window.removeEventListener('wheel', onWheel as any);
  }, []);

  // chat removed

  // caret handling for contenteditable is done inline in handlers

  // Simple variables intellisense state
  const [showVarsMenu, setShowVarsMenu] = React.useState(false);
  const [varsMenuFilter, setVarsMenuFilter] = React.useState('');
  const [varsMenuActiveField] = React.useState<'nl' | 'script' | null>(null);
  const [varsMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [varsMenuPos] = React.useState<{ left: number; top: number } | null>(null);
  const [varsMenuMaxH] = React.useState<number>(280);
  const varsMenuRef = React.useRef<HTMLDivElement>(null);
  const [varsMenuHover, setVarsMenuHover] = React.useState<boolean>(false);
  const [varsNavIndex, setVarsNavIndex] = React.useState<number>(0);
  const [expandedActs, setExpandedActs] = React.useState<Record<string, boolean>>({});
  const [expandedMains, setExpandedMains] = React.useState<Record<string, boolean>>({});
  const filteredVarsForMenu = React.useMemo(() => {
    const f = (varsMenuFilter || '').trim().toLowerCase();
    if (!f) return varsKeys;
    return varsKeys.filter(k => k.toLowerCase().includes(f));
  }, [varsKeys, varsMenuFilter]);
  // const flatTreeTokens = React.useMemo(() => [], [variablesTree]);
  // ✅ REFACTOR: Use domain function
  const filteredTreeActs = React.useMemo(() => {
    return filterVariablesTree(variablesTree || [], varsMenuFilter);
  }, [variablesTree, varsMenuFilter]);

  // Navigation entries (include act rows so Enter toggles expansion)
  type NavEntry = { key: string; kind: 'act' | 'main' | 'sub' | 'token'; token?: string; act?: string; main?: string; sub?: string };
  const { navEntries, navIndexByKey } = React.useMemo(() => {
    const entries: NavEntry[] = [];
    const indexByKey = new Map<string, number>();
    if (variablesTree && (variablesTree.length > 0)) {
      (filteredTreeActs || []).forEach(act => {
        // Act row always visible
        entries.push({ key: `ACT::${act.label}`, kind: 'act', act: act.label });
        indexByKey.set(`ACT::${act.label}`, entries.length - 1);
        // Visible mains only when act expanded
        if (expandedActs[act.label]) {
          (act.mains || []).forEach(m => {
            entries.push({ key: `${act.label}.${m.label}`, kind: 'main', token: `${act.label}.${m.label}`, act: act.label, main: m.label });
            indexByKey.set(`${act.label}.${m.label}`, entries.length - 1);
            // Visible subs only when main expanded
            if (expandedMains[`${act.label}::${m.label}`]) {
              (m.subs || []).forEach(s => {
                const k = `${act.label}.${m.label}.${s.label}`;
                entries.push({ key: k, kind: 'sub', token: k, act: act.label, main: m.label, sub: s.label });
                indexByKey.set(k, entries.length - 1);
              });
            }
          });
        }
      });
    } else {
      filteredVarsForMenu.forEach(k => { entries.push({ key: k, kind: 'token', token: k }); indexByKey.set(k, entries.length - 1); });
    }
    return { navEntries: entries, navIndexByKey: indexByKey };
  }, [variablesTree, filteredTreeActs, filteredVarsForMenu, expandedActs, expandedMains]);

  const navigateIntellisense = React.useCallback((key: 'ArrowUp' | 'ArrowDown' | 'Enter') => {
    const len = navEntries.length;
    if (len === 0) return;
    if (key === 'Enter') {
      const entry = navEntries[Math.max(0, Math.min(varsNavIndex, len - 1))];
      if (!entry) return;
      if (entry.kind === 'act' && entry.act) {
        setExpandedActs(prev => ({ ...prev, [entry.act!]: !prev[entry.act!] }));
      } else if (entry.token) {
        insertVariableToken(entry.token);
      }
      return;
    }
    setVarsNavIndex(prev => {
      const next = key === 'ArrowDown' ? (prev + 1) % len : (prev - 1 + len) % len;
      setTimeout(() => {
        const el = varsMenuRef.current?.querySelector(`[data-nav-index="${next}"]`) as HTMLElement | null;
        if (el) el.scrollIntoView({ block: 'nearest' });
      }, 0);
      return next;
    });
  }, [varsNavIndex, navEntries]);

  // Move selection with Up/Down and commit with Enter even if focus stays in textarea
  React.useEffect(() => {
    if (!showVarsMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (!showVarsMenu) return;
      const key = e.key;
      const target: any = e.target as any;
      const tag = (target && target.tagName && String(target.tagName).toLowerCase()) || '';
      const isInField = tag === 'textarea' || tag === 'input' || (target && target.isContentEditable);
      if (isInField) return; // field handlers already processed arrows; avoid double step
      if (key === 'ArrowDown' || key === 'ArrowUp') {
        e.preventDefault();
        navigateIntellisense(key);
      } else if (key === 'Enter') {
        if (navEntries.length > 0) { e.preventDefault(); navigateIntellisense('Enter'); }
      } else if (key === 'Escape') {
        e.preventDefault();
        setShowVarsMenu(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showVarsMenu, navEntries, varsNavIndex, navigateIntellisense]);

  // While hovering the menu, Up/Down arrows scroll the list
  React.useEffect(() => {
    if (!showVarsMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (!varsMenuHover) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const el = varsMenuRef.current;
      if (!el) return;
      e.preventDefault();
      const delta = 48; // scroll step
      el.scrollBy({ top: e.key === 'ArrowDown' ? delta : -delta, behavior: 'smooth' });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showVarsMenu, varsMenuHover]);

  // ✅ Update script when initialScript changes, converting GUID → label for display
  React.useEffect(() => {
    console.log('[ConditionEditor][UPDATE] 🔄 initialScript changed', {
      hasInitialScript: !!(initialScript && initialScript.trim()),
      initialScriptLength: initialScript?.length || 0,
      initialScriptPreview: initialScript?.substring(0, 100) || ''
    });

    if (initialScript && initialScript.trim()) {
      console.log('[ConditionEditor][UPDATE] 🔄 Converting GUID → label');
      const scriptWithLabels = convertScriptGuidsToLabels(initialScript);
      console.log('[ConditionEditor][UPDATE] ✅ Conversion complete', {
        originalLength: initialScript.length,
        convertedLength: scriptWithLabels.length,
        changed: initialScript !== scriptWithLabels
      });
      setScript(scriptWithLabels);
    } else {
      console.log('[ConditionEditor][UPDATE] ℹ️ No initial script, using DEFAULT_CODE');
      setScript(DEFAULT_CODE);
    }
  }, [initialScript]);

  // legacy filtered list removed (hierarchical tree used instead)

  // ✅ REFACTOR: Use domain function
  const variablesFlat = React.useMemo(() => {
    if (variablesTree && variablesTree.length) {
      return flattenVariablesTree(variablesTree);
    }
    return Object.keys(variables || {});
  }, [variablesTree, variables]);

  // ✅ REFACTOR: Use domain function
  const usedVarsInScript = React.useMemo(() => {
    return extractUsedVariables(script);
  }, [script]);

  const hasVarsInScript = React.useMemo(() => (usedVarsInScript.length > 0), [usedVarsInScript]);
  const variablesUsedInScript = React.useMemo(() => (hasVarsInScript ? usedVarsInScript : variablesFlat), [hasVarsInScript, usedVarsInScript, variablesFlat]);

  // Keep variables visible even after regenerate: union of used-in-script and user-selected
  const variablesForPanel = React.useMemo(() => {
    const set = new Set<string>();
    (variablesUsedInScript || []).forEach(k => set.add(k));
    (selectedVars || []).forEach(k => set.add(k));
    return Array.from(set);
  }, [hasCreated, variablesUsedInScript, selectedVars]);

  // ✅ REFACTOR: Use domain function
  const variablesForTester = React.useMemo(() => {
    return filterVariablesForTester(variablesUsedInScript || []);
  }, [variablesUsedInScript]);

  // ✅ REFACTOR: Use domain function
  // preferredVarByTail is already extracted in useConditionEditorState
  const duplicateGroups = React.useMemo(() => {
    return findDuplicateGroups(variablesFlat);
  }, [variablesFlat]);
  const variablesFlatWithPreference = React.useMemo(() => {
    if (duplicateGroups.length === 0) return variablesFlat;
    const chosen = new Set<string>(variablesFlat);
    duplicateGroups.forEach(g => {
      const pref = preferredVarByTail[g.tail];
      if (pref && g.options.includes(pref)) {
        g.options.forEach(opt => { if (opt !== pref) chosen.delete(opt); });
      }
    });
    return Array.from(chosen);
  }, [variablesFlat, duplicateGroups, preferredVarByTail]);

  // Keep selected vars in sync after script generation (defaults = vars used in script)
  React.useEffect(() => {
    if (!hasCreated || !hasVarsInScript) return;
    try {
      const defaults = variablesUsedInScript;
      setSelectedVars(prev => (prev.length === 0 ? defaults : prev));
    } catch {}
  }, [hasCreated, hasVarsInScript, script]);

  // const userChangedSelection = React.useMemo(() => {
  //   const a = [...(variablesUsedInScript || [])].sort().join('|');
  //   const b = [...(selectedVars || [])].sort().join('|');
  //   return hasCreated && a !== b;
  // }, [variablesUsedInScript, selectedVars, hasCreated]);

  // helper to append text into NL was removed (not used)

  // kept for legacy but unused now that code is always auto-formatted

  // Expose available variable keys globally for editor completion
  React.useEffect(() => {
    try {
      const keys = Array.from(new Set((variablesFlat || []).concat(variablesForPanel || [])));
      (window as any).__omniaVarKeys = keys;
    } catch {}
  }, [variablesFlat, variablesForPanel]);

  // Sync toolbar labels from tester hints when provided
  // tester owns labels; nothing to sync here

  // Tester control wiring (declared BEFORE any early return to keep hook order stable)
  // testerAllPass is already extracted in useConditionEditorState
  const testerRunRef = React.useRef<() => void>(() => {});
  const handleAddTestLine = React.useRef<() => void>(() => {});
  const getFailuresRef = React.useRef<() => Array<any>>(() => []);
  const hasFailuresRef = React.useRef<() => boolean>(() => false);
  const resetTesterVisualsRef = React.useRef<() => void>(() => {});
  const markNotesAsUsedRef = React.useRef<() => void>(() => {});
  const resetTesterVisuals = React.useCallback(() => {
    setTesterAllPass(null);
    // Clear any previous not-passed comments by resetting test rows labels only
    setTestRows(prev => prev.map(r => ({ ...r })));
  }, [setTesterAllPass, setTestRows]);
  // hasFailures and lastAcceptedScript are already extracted in useConditionEditorState

  // No animated text; only a spinner and color change while busy

  if (!open) return null;

  const containerStyle: React.CSSProperties = dockWithinParent
    ? { position: 'absolute', left: 0, right: 0, bottom: 0, height: heightPx, fontSize: fontPx }
    : { position: 'fixed', left: 0, right: 0, bottom: 0, height: heightPx, fontSize: fontPx };

  const onStartResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      try {
        const parentBottom = dockWithinParent ? (containerRef.current?.parentElement?.getBoundingClientRect().bottom ?? window.innerHeight) : window.innerHeight;
        const maxH = dockWithinParent ? ((containerRef.current?.parentElement?.getBoundingClientRect().height ?? window.innerHeight) - 40) : (window.innerHeight - 40);
        const minH = 220;
        const next = Math.max(minH, Math.min(maxH, parentBottom - ev.clientY));
        setHeightPx(next);
      } catch {}
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'ns-resize';
  };

  // ✅ REFACTOR: Use ConditionAIService
  const modify = async () => {
    setBusy(true);
    try {
      const result = await aiService.normalizePseudoCode({
        script: script || '',
        currentCode: lastAcceptedScript || '',
        variables: variablesFlatWithPreference,
        label: titleValue,
        provider: (window as any).__AI_PROVIDER || undefined,
      });

      if (result.script && result.script.trim()) {
        setScript(result.script);
        updateProjectDataScript(result.script);
        setHasCreated(true);
        setLastAcceptedScript(result.script);
        setShowTester(true);
        setAiQuestion('');
        // Format after modify
        setTimeout(() => {
          try {
            codeEditorRef.current?.format();
          } catch (e) {
            console.warn('[ConditionEditor] Format failed:', e);
          }
        }, 300);
        return;
      }
    } catch (e) {
      console.error('[ConditionEditor] Modify failed:', e);
    } finally {
      setBusy(false);
    }
  };

  // ✅ REFACTOR: Use ConditionAIService
  const generate = async () => {
    const nlText = script;
    if (!nlText) {
      setAiQuestion('Inserisci una descrizione in linguaggio naturale.');
      return;
    }
    if (!variablesFlatWithPreference || variablesFlatWithPreference.length === 0) {
      setAiQuestion('Nessuna variabile disponibile: controlla la struttura DDT o le variabili di progetto.');
      return;
    }

    setBusy(true);
    try {
      const result = await aiService.generateCondition({
        nlText,
        variables: variablesFlatWithPreference,
        selectedVars,
        variablesFlatWithPreference,
        titleValue,
        duplicateGroups,
        preferredVarByTail,
        variablesUsedInScript,
      });

      if (result.question && !result.script) {
        setAiQuestion(result.question);
        if (result.pendingDupGroups) {
          setPendingDupGroups(result.pendingDupGroups);
        }
        return;
      }

      if (result.script) {
        if (result.label && result.label !== titleValue) {
          setTitleValue(result.label);
        }
        setScript(result.script);
        updateProjectDataScript(result.script);
        setShowCode(true);
        setHasCreated(true);
        setLastAcceptedScript(result.script);
        setShowTester(true);
        setAiQuestion('');

        if (result.testRows && result.testRows.length > 0) {
          setTestRows(result.testRows);
        }
        if (result.testerHints) {
          setTesterHints(result.testerHints);
        }

        // Format after generate
        setTimeout(() => {
          try {
            codeEditorRef.current?.format();
          } catch (e) {
            console.warn('[ConditionEditor] Format failed:', e);
          }
        }, 300);
      } else {
        setAiQuestion(result.question || 'Si è verificato un errore durante la generazione. Riprova.');
        setScript('try { return false; } catch { return false; }');
      }
    } catch (e) {
      const msg = String((e as any)?.message || '').toLowerCase();
      if (msg.includes('backend_error:')) {
        setAiQuestion('Errore backend: ' + msg.replace('backend_error:', '').trim());
      } else if (msg.includes('missing vite_groq_key')) {
        setAiQuestion('AI non configurata: imposta VITE_GROQ_KEY (o VITE_GROQ_API_KEY) nel file .env.local e riavvia il dev server.');
      } else if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('cors')) {
        setAiQuestion('AI non raggiungibile (rete/CORS). Verifica connessione o proxy.');
      } else {
        setAiQuestion('Si è verificato un errore durante la generazione. Riprova.');
      }
      setScript('try { return false; } catch { return false; }');
    } finally {
      setBusy(false);
    }
  };

  // removed old single-result tester header (replaced by right panel)

  // ✅ REFACTOR: Use VariablesIntellisenseService
  const insertVariableToken = (varKey: string) => {
    const target = varsMenuActiveField === 'nl' ? (nlCERef.current as any) : scriptRef.current;
    if (!target) return;

    if (varsMenuActiveField === 'nl') {
      intellisenseService.insertVariableTokenInContentEditable(varKey, target as HTMLElement, () => setNl(serializeCE()));
    } else if (varsMenuActiveField === 'script') {
      const current = script;
      const caret = scriptCaretRef.current || { start: current.length, end: current.length };
      const result = intellisenseService.insertVariableTokenInScript(varKey, current, caret);
      setScript(result.newScript);
      scriptCaretRef.current = result.newCaret;
      setTimeout(() => {
        try {
          target.focus();
          (target as any).setSelectionRange(result.newCaret.start, result.newCaret.end);
        } catch {}
      }, 0);
    }

    setShowVarsMenu(false);
  };

  const toggleAct = (label: string) => setExpandedActs(prev => ({ ...prev, [label]: !prev[label] }));
  const toggleMain = (actLabel: string, mainLabel: string) => {
    const key = `${actLabel}::${mainLabel}`;
    setExpandedMains(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getDDTIcon = (kind?: string) => {
    try { return getDDTIconFromRE(String(kind || '')); } catch { return null as any; }
  };

  // Serialize contentEditable into NL string preserving tokens as {token}
  const serializeCE = (): string => {
    const root = nlCERef.current;
    if (!root) return nl;
    const collect = (node: Node): string => {
      if (node.nodeType === 3) return node.textContent || '';
      const el = node as HTMLElement;
      if (el.getAttribute && el.getAttribute('data-token')) return el.textContent || '';
      let out = '';
      el.childNodes.forEach(ch => { out += collect(ch); });
      return out;
    };
    return collect(root).replace(/\u00A0/g, ' ');
  };

  // removed legacy handleKeyDownForField (monaco/contenteditable handle own shortcuts)

  const ConditionIcon = SIDEBAR_ICON_COMPONENTS[SIDEBAR_TYPE_ICONS.conditions];

  return (
    <div ref={containerRef} style={{ ...containerStyle, background: 'var(--sidebar-bg, #0b1220)', display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 6, padding: 12, zIndex: 1000 }}>
      {/* Top drag handle for vertical resize */}
      <div onMouseDown={onStartResize} title="Drag to resize" style={{ cursor: 'ns-resize', height: 6, margin: '-12px -12px 6px -12px' }} />
      {/* Header with editable title and close */}
      <div
        onMouseEnter={() => setHeaderHover(true)}
        onMouseLeave={() => setHeaderHover(false)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: 'none', background: '#f59e0b', margin: '-12px -12px 6px -12px', borderTopLeftRadius: 6, borderTopRightRadius: 6 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isEditingTitle ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {ConditionIcon ? <ConditionIcon className="w-4 h-4" style={{ color: '#0b1220' }} /> : null}
              <span style={{ fontWeight: 700, color: '#0b1220' }}>{titleValue}</span>
              <button title="Edit title" onClick={() => setIsEditingTitle(true)} style={{ color: '#0b1220', visibility: headerHover ? 'visible' : 'hidden' }}>
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                ref={titleInputRef}
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); setIsEditingTitle(false); onRename?.(titleValue.trim() || 'Condition'); }
                  else if (e.key === 'Escape') { e.preventDefault(); setIsEditingTitle(false); setTitleValue(label || 'Condition'); }
                }}
                style={{ width: titleInputPx, padding: '4px 6px', border: '1px solid #0b1220', borderRadius: 6, background: 'transparent', color: '#0b1220' }}
              />
              <button
                title="Confirm"
                onClick={() => { setIsEditingTitle(false); onRename?.(titleValue.trim() || 'Condition'); }}
                style={{ color: '#22c55e' }}
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                title="Cancel"
                onClick={() => { setIsEditingTitle(false); setTitleValue(label || 'Condition'); }}
                style={{ color: '#ef4444' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <button onClick={onClose} title="Close" style={{ color: '#0b1220' }}>
          <X className="w-4 h-4" />
        </button>
      </div>
      {/* hidden measurer for title autosize */}
      <span ref={titleMeasureRef} style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'pre', fontWeight: 700, fontFamily: 'inherit', fontSize: '14px', padding: '4px 6px', border: '1px solid transparent' }} />
      {/* Controls + editor */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
        {/* Duplicate variable preference selector (only when required) */}
        {pendingDupGroups && pendingDupGroups.length > 0 && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '6px 8px', border: '1px dashed #334155', borderRadius: 6 }}>
            {pendingDupGroups.map((g: { tail: string; options: string[] }) => (
              <div key={g.tail} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#94a3b8', fontSize: 12 }}>{g.tail}:</span>
                {g.options.map((opt: string) => (
                  <label key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#e5e7eb', fontSize: 12 }}>
                    <input
                      type="radio"
                      name={`dup-${g.tail}`}
                      checked={(preferredVarByTail[g.tail] || g.options[0]) === opt}
                      onChange={() => setPreferredVarByTail(prev => ({ ...prev, [g.tail]: opt }))}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
        {/* Clarification banner (AI question) */}
        {aiQuestion && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '8px 10px',
              border: '1px solid #f59e0b',
              borderRadius: 6,
              background: 'rgba(245,158,11,0.08)',
              color: '#f59e0b',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              flex: '0 0 auto',
              overflow: 'hidden'
            }}
          >
            <span style={{ fontWeight: 700, flex: '0 0 auto' }}>AI:</span>
            <span style={{ flex: '1 1 auto' }}>{aiQuestion}</span>
          </div>
        )}
        {/* Runtime error banner (set from tester) */}
        {runtimeErrorMsg && (
          <div style={{ padding: '6px 10px', border: '1px solid #7f1d1d', borderRadius: 6, background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>
            {runtimeErrorMsg}
          </div>
        )}
        {/* Layout by mode */}
        {(() => {
          const columns: string[] = [];
          const add = (w: string, addSplitter: boolean) => { columns.push(w); if (addSplitter) columns.push('4px'); };
          // describe removed; compute columns for remaining panels
          const hasNextAfterVars = (!!showCode) || (!!showTester);
          const hasNextAfterCode = (!!showTester);
          // Describe column removed
          if (showVariablesPanel) add(`${wVars}px`, hasNextAfterVars);
          if (showCode) add('minmax(420px, 2fr)', hasNextAfterCode);
          if (showTester) add(`${wTester}px`, false);
          if (columns.length === 0) columns.push('1fr');
          return (
        <div style={{ display: 'grid', gridTemplateColumns: columns.join(' '), gap: 6, alignItems: 'stretch', flex: '1 1 auto', minHeight: 0 }}>
          {/* Describe panel removed */}
          {/* Variables panel (now before Code) */}
          {showVariablesPanel ? (
            <VariablesPanel
              variables={variablesForPanel}
              selected={selectedVars}
              onChange={setSelectedVars}
              onClose={() => setShowVariablesPanel(false)}
            />
          ) : null}
          {/* splitter after Variables if next column exists */}
          {showVariablesPanel && (showTester || showCode) && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX; const startW = wVars;
                const onMove = (ev: MouseEvent) => {
                  const dx = ev.clientX - startX; let nw = startW + dx;
                  nw = Math.max(200, Math.min(420, nw)); setWVars(nw);
                };
                const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor=''; };
                document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); document.body.style.cursor='col-resize';
              }}
              style={{ cursor: 'col-resize', width: 4, margin: '0 2px', background: 'rgba(148,163,184,0.25)', borderRadius: 2 }}
            />
          )}
          {/* Code panel - CodeEditor with toolbar */}
          {showCode && (
          <div style={{ height: '100%', border: '1px solid #334155', borderRadius: 6, overflow: 'hidden', background: '#0b1220', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderBottom: '1px solid #334155' }}>
              {/* Generate button - uses CodeEditor logic via onGenerateClick */}
              {(() => {
                const isScaffold = normalizeCode(script) === normalizeCode(DEFAULT_CODE);
                const isEmpty = normalizeCode(script).length === 0;
                // ✅ Mostra sempre il pulsante se c'è testo (non vuoto, anche se è lo scaffold)
                const scriptTrimmed = String(script || '').trim();
                const hasText = scriptTrimmed.length > 0; // ✅ Qualsiasi testo, anche commenti
                const canCreate = hasText && !hasCreated; // ✅ Mostra se c'è testo e non è stato ancora generato
                const canModify = hasCreated && String(script || '') !== String(lastAcceptedScript || '');
                const showMain = hasFailures || canCreate || canModify;

                if (!showMain) return null;
                const label = hasFailures ? 'Fix code' : (canModify ? 'Modify code' : 'Create code');
                const busyLabel = hasFailures ? 'Fixing code...' : (canModify ? 'Modifying code...' : 'Creating code...');
                const titleText = hasFailures ? 'Fix code using your classified failures' : (canModify ? 'Modify the code based on your edits' : 'Generate code from your description');

                return (
                  <button
                    title={titleText}
                    onClick={async () => {
                      if (hasFailures) {
                        setBusy(true);
                        try {
                          const failures = getFailuresRef.current?.() || [];
                          const resp = await aiService.repairCondition({
                            script,
                            failures,
                            variables: variablesForTester,
                            provider: (window as any).__AI_PROVIDER || undefined,
                          });
                          if (resp.script && typeof resp.script === 'string') {
                            setScript(resp.script);
                            updateProjectDataScript(resp.script);
                            setLastAcceptedScript(resp.script);
                            resetTesterVisuals();
                            resetTesterVisualsRef.current?.();
                            setTesterAllPass(null);
                            setHasFailures(false);
                            // Format after repair
                            setTimeout(() => {
                              try {
                                codeEditorRef.current?.format();
                              } catch (e) {
                                console.warn('[ConditionEditor] Format failed:', e);
                              }
                            }, 300);
                          } else {
                            setAiQuestion('Repair failed: ' + String(resp.error || 'repair_failed'));
                          }
                        } catch (e) {
                          console.error('[ConditionEditor] Repair failed:', e);
                        } finally {
                          setBusy(false);
                        }
                        return;
                      }
                      if (canModify) { await modify(); return; }
                      if (canCreate) { await generate(); return; }
                    }}
                    disabled={busy}
                    style={{ border: '1px solid #334155', borderRadius: 6, padding: '6px 10px', background: busy ? 'rgba(148,163,184,0.10)' : 'transparent', color: busy ? '#b45309' : '#e5e7eb', fontWeight: 700, minWidth: 160, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{busyLabel}</span>
                      </>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Code2 className="w-4 h-4" /> {label}</span>
                    )}
                  </button>
                );
              })()}
              <button
                title="Change the selection of the variables to consider"
                aria-pressed={showVariablesPanel}
                onClick={() => setShowVariablesPanel(v => !v)}
                style={{ border: '1px solid', borderColor: showVariablesPanel ? '#38bdf8' : '#334155', borderRadius: 6, padding: '6px 10px', background: showVariablesPanel ? 'rgba(56,189,248,0.15)' : 'transparent', color: showVariablesPanel ? '#e5e7eb' : '#cbd5e1', fontWeight: showVariablesPanel ? 700 : 500 }}
              ><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ListChecks className="w-4 h-4" /> {showVariablesPanel ? 'Hide variables' : 'Show variables'}</span></button>
              {hasCreated && (
                <button
                  title="Open/close the test panel"
                  aria-pressed={showTester}
                  onClick={() => setShowTester(v => !v)}
                  style={{ border: '1px solid', borderColor: showTester ? '#38bdf8' : '#334155', borderRadius: 6, padding: '6px 10px', background: showTester ? 'rgba(56,189,248,0.15)' : 'transparent', color: showTester ? '#e5e7eb' : '#cbd5e1', fontWeight: showTester ? 700 : 500 }}
                ><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FlaskConical className="w-4 h-4" /> Test Code</span></button>
              )}
            </div>
            <CodeEditor
              ref={codeEditorRef}
              initialCode={script}
              initialMode={'predicate'}
              fontPx={fontPx}
              initialVars={(variablesFlat || []).map(k => ({ key: k, type: 'string', description: k, sensitivity: 'public' })) as any}
              onCodeChange={(code) => {
                // Keep banner hidden when user is writing; only show when Generate validates
                setAiQuestion('');
                setScript(code);
                // Request lint markers optionally here in the future
                // clear runtime markers on edit
                try {
                  const ed = monacoEditorRef.current?.editor || monacoEditorRef.current;
                  const monaco = monacoInstanceRef.current;
                  if (ed && monaco) clearMonacoMarkers(ed, monaco as any, 'conditions-runtime');
                  setRuntimeErrorMsg(null);
                } catch {}
              }}
              ai={{
                codeEditToPatch: async ({ instructions, execution }) => {
                  try {
                    const out = await generateConditionWithAI(instructions || serializeCE(), variablesUsedInScript);
                    const newScript = (out as any)?.script || execution.code;
                    const a = execution.code.replace(/\r/g, '');
                    const b = String(newScript || '').replace(/\r/g, '');
                    if (a === b) return '--- a/code\n+++ b/code\n';
                    return `--- a/code\n+++ b/code\n@@ -1,1 +1,1 @@\n-${a}\n+${b}`;
                  } catch {
                    return '--- a/code\n+++ b/code\n';
                  }
                },
                suggestTestCases: async ({ code, mode, variables, nl }) => {
                  try {
                    const nlText = nl || serializeCE();
                    const cases = await suggestConditionCases(nlText, variables);
                    return cases;
                  } catch {
                    return {};
                  }
                }
              }}
              tests={{
                run: async () => ({ pass: 0, fail: 0, blocked: 0, ms: 0, results: [] })
              }}
              onPatchApplied={({ code }) => {
                setScript(code);
                // After applying patch, also suggest test cases if in predicate mode
                if (code && variablesUsedInScript.length > 0) {
                  // This will be handled by CodeEditor's generate() if called via onGenerateClick
                  // But we can also trigger it here if needed
                }
              }}
              layout="compact"
              showGenerateButton={false}
              onGenerateClick={async () => {
                // Use CodeEditor's ai.codeEditToPatch to generate diff instead of setting script directly
                // This will show the DiffPanel in CodeEditor
                setBusy(true);
                try {
                  if (hasFailures) {
                    const failures = getFailuresRef.current?.() || [];
                    const resp = await aiService.repairCondition({
                      script,
                      failures,
                      variables: variablesForTester,
                      provider: (window as any).__AI_PROVIDER || undefined,
                    });
                    if (resp.script && typeof resp.script === 'string') {
                      setScript(resp.script);
                      updateProjectDataScript(resp.script);
                      setLastAcceptedScript(resp.script);
                      resetTesterVisuals();
                      resetTesterVisualsRef.current?.();
                      markNotesAsUsedRef.current?.(); // Mark notes as used after successful repair
                      setTesterAllPass(null);
                      setHasFailures(false);
                      // Format after repair
                      setTimeout(() => {
                        try {
                          codeEditorRef.current?.format();
                        } catch (e) {
                          console.warn('[ConditionEditor] Format failed:', e);
                        }
                      }, 100);
                    } else {
                      setAiQuestion('Repair failed: ' + String(resp.error || 'repair_failed'));
                    }
                    return;
                  }

                  const isScaffold = normalizeCode(script) === normalizeCode(DEFAULT_CODE);
                  const isEmpty = normalizeCode(script).length === 0;
                  const hasText = !isEmpty && normalizeCode(script).trim().length > 0;
                  const canCreate = hasText && !hasCreated;
                  const canModify = hasCreated && String(script || '') !== String(lastAcceptedScript || '');

                  // Call generate/modify directly (they will set script, CodeEditor will sync via initialCode prop)
                  if (canModify) {
                    await modify();
                  } else if (canCreate) {
                    await generate();
                  }
                } finally {
                  setBusy(false);
                }
              }}
              onTestCasesSuggested={(cases) => {
                // Convert TestCase[] to CaseRow[]
                const rows: CaseRow[] = cases.map(tc => ({
                  id: tc.id,
                  label: tc.expectedBoolean === true ? 'true' : 'false',
                  vars: tc.values as Record<string, any>
                }));
                if (rows.length) {
                  setTestRows(rows);
                  // Set hints from test cases
                  const trueCase = cases.find(c => c.expectedBoolean === true);
                  const falseCase = cases.find(c => c.expectedBoolean === false);
                  setTesterHints({
                    hintTrue: trueCase?.hint,
                    hintFalse: falseCase?.hint
                  });
                }
              }}
            />
          </div>
          )}
          {/* splitter after Code if tester exists (visual grip) */}
          {showCode && showTester && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX; const startW = wTester;
                const onMove = (ev: MouseEvent) => {
                  const dx = startX - ev.clientX; // moving left grows tester, right shrinks
                  let nw = startW + dx;
                  nw = Math.max(260, Math.min(540, nw)); setWTester(nw);
                };
                const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor=''; };
                document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); document.body.style.cursor='col-resize';
              }}
              style={{ cursor: 'col-resize', width: 4, margin: '0 2px', background: 'rgba(148,163,184,0.25)', borderRadius: 2 }}
            />
          )}
          {/* Tester column when enabled */}
          {showTester && (
            <div style={{ height: '100%', border: '1px solid #334155', borderRadius: 6, overflow: 'hidden', background: '#0b1220' }}>
              <ConditionTester
                script={script}
                variablesList={variablesForTester}
                initialCases={testRows}
                onChange={setTestRows}
                hintTrue={testerHints.hintTrue}
                hintFalse={testerHints.hintFalse}
                title={titleValue}
                registerRun={(fn) => { testerRunRef.current = fn; }}
                registerControls={(api) => { handleAddTestLine.current = api.addRow; testerRunRef.current = api.run; getFailuresRef.current = api.getFailures; hasFailuresRef.current = api.hasFailures; resetTesterVisualsRef.current = api.resetVisuals; markNotesAsUsedRef.current = api.markNotesAsUsed; }}
                onRunResult={(pass) => setTesterAllPass(pass)}
              onFailuresChange={(flag) => setHasFailures(flag)}
              onRuntimeError={(payload) => {
                try {
                  const ed = monacoEditorRef.current?.editor || monacoEditorRef.current;
                  const monaco = monacoInstanceRef.current;
                  if (ed && monaco) {
                    const markers = payload && payload.message ? [{
                      severity: (monacoNS as any).MarkerSeverity.Error,
                      message: `[runtime] ${payload.message}`,
                      startLineNumber: Math.max(1, payload.line || 1), startColumn: Math.max(1, payload.column || 1),
                      endLineNumber: Math.max(1, payload.line || 1), endColumn: Math.max(1, (payload.column || 1) + 1),
                    }] : [];
                    setMonacoMarkers(ed, monaco as any, markers as any, 'conditions-runtime');
                  }
                } catch {}
                setRuntimeErrorMsg(payload?.message || null);
              }}
              />
            </div>
          )}
        </div>
        )})()}
      </div>
      {/* Variables Intellisense Menu */}
      {showVarsMenu && varsMenuAnchor && (
        <div
          ref={varsMenuRef}
          style={{
            position: 'fixed',
            left: varsMenuPos ? varsMenuPos.left : (varsMenuAnchor.getBoundingClientRect().left || 0),
            top: varsMenuPos ? varsMenuPos.top : (varsMenuAnchor.getBoundingClientRect().bottom || 0) + 6,
            width: 360,
            maxHeight: varsMenuMaxH,
            minHeight: 120,
            overflowY: 'scroll',
            paddingRight: 6,
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 8,
            zIndex: 9999,
            boxShadow: '0 8px 28px rgba(2,6,23,0.5)'
          }}
          onMouseEnter={() => setVarsMenuHover(true)}
          onMouseLeave={() => setVarsMenuHover(false)}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div style={{ padding: 8, borderBottom: '1px solid #334155' }}>
            <input
              value={varsMenuFilter}
              onChange={(e) => setVarsMenuFilter(e.target.value)}
              placeholder="Filter variables (type to search)"
              style={{ width: '100%', padding: 6, border: '1px solid #334155', borderRadius: 6, background: 'transparent', color: '#e5e7eb' }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { e.preventDefault(); setShowVarsMenu(false); }
                else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); navigateIntellisense(e.key); }
                else if (e.key === 'Enter') { e.preventDefault(); navigateIntellisense('Enter'); }
              }}
            />
          </div>
          <div style={{ padding: 6 }}>
            {/* Hierarchical tree (acts -> mains -> subs). Fallback to flat list if no tree provided */}
            {(variablesTree && (variablesTree.length > 0)) ? (
              (filteredTreeActs.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: 12, padding: 8 }}>No variables</div>
              ) : (
                filteredTreeActs.map((act, ai) => (
                  <div key={`act-${ai}`} style={{ marginBottom: 6 }}>
                    <div
                      data-nav-index={navIndexByKey.get(`ACT::${act.label}`) ?? -1}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, color: act.color || '#e5e7eb', fontWeight: 600, padding: '6px 8px', cursor: 'pointer', background: (navEntries[varsNavIndex]?.key === `ACT::${act.label}`) ? 'rgba(56,189,248,0.15)' : undefined }}
                      onClick={() => { setVarsNavIndex(navIndexByKey.get(`ACT::${act.label}`) ?? 0); toggleAct(act.label); }}
                    >
                      <span style={{ width: 12, display: 'inline-block', transform: expandedActs[act.label] ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.1s' }}>▶</span>
                      {act.Icon ? <act.Icon className="w-4 h-4" style={{ color: act.color || '#e5e7eb' }} /> : null}
                      <span>{act.label}</span>
                    </div>
                    {expandedActs[act.label] === true && (act.mains || []).map((m, mi) => (
                      <div key={`main-${ai}-${mi}`} style={{ marginLeft: 18 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            onClick={() => toggleMain(act.label, m.label)}
                            style={{ color: '#94a3b8' }}
                            title="Expand/Collapse"
                          >
                            <span style={{ width: 12, display: 'inline-block', transform: expandedMains[`${act.label}::${m.label}`] ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.1s' }}>▶</span>
                          </button>
                          <div
                            className="hover:bg-slate-700"
                            data-nav-index={navIndexByKey.get(`${act.label}.${m.label}`) ?? -1}
                            style={{ padding: '6px 8px', borderRadius: 6, color: '#e5e7eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flex: 1, background: (navEntries[varsNavIndex]?.token === `${act.label}.${m.label}`) ? 'rgba(56,189,248,0.15)' : undefined }}
                            onClick={() => { setVarsNavIndex(navIndexByKey.get(`${act.label}.${m.label}`) ?? 0); insertVariableToken(`${act.label}.${m.label}`); }}
                          >
                            {getDDTIcon(m.kind)}
                            <span>{m.label}</span>
                          </div>
                        </div>
                        {expandedMains[`${act.label}::${m.label}`] === true && (m.subs || []).map((s, si) => (
                          <div
                            key={`sub-${ai}-${mi}-${si}`}
                            className="hover:bg-slate-700"
                            data-nav-index={navIndexByKey.get(`${act.label}.${m.label}.${s.label}`) ?? -1}
                            style={{ padding: '6px 8px', borderRadius: 6, color: '#e5e7eb', cursor: 'pointer', marginLeft: 28, background: (navEntries[varsNavIndex]?.token === `${act.label}.${m.label}.${s.label}`) ? 'rgba(56,189,248,0.15)' : undefined }}
                            onClick={() => { setVarsNavIndex(navIndexByKey.get(`${act.label}.${m.label}.${s.label}`) ?? 0); insertVariableToken(`${act.label}.${m.label}.${s.label}`); }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              {getDDTIcon(s.kind)}
                              <span>{s.label}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))
              ))
            ) : (
              (filteredVarsForMenu.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: 12, padding: 8 }}>No variables</div>
              ) : (
                filteredVarsForMenu.map(k => (
                  <div
                    key={k}
                    data-nav-index={navIndexByKey.get(k) ?? -1}
                    style={{ padding: '6px 8px', borderRadius: 6, color: '#e5e7eb', cursor: 'pointer', background: (navEntries[varsNavIndex]?.token === k) ? 'rgba(56,189,248,0.15)' : undefined }}
                    className="hover:bg-slate-700"
                    onClick={() => { setVarsNavIndex(navIndexByKey.get(k) ?? 0); insertVariableToken(k); }}
                  >
                    {k}
                  </div>
                ))
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}


