import React from 'react';
import { getDDTIcon as getDDTIconFromRE } from '@responseEditor/ddtUtils';
// ✅ REFACTOR: AI functions now in ConditionAIService
import ConditionTester, { CaseRow } from './ConditionTester';
import CodeEditor, { CodeEditorRef } from '@components/CodeEditor/CodeEditor';
import * as monacoNS from 'monaco-editor';
import { setMonacoMarkers, clearMonacoMarkers } from '@utils/monacoMarkers';
import { X, Pencil, Check, Code2, FlaskConical, ListChecks, Loader2 } from 'lucide-react';
import { SIDEBAR_ICON_COMPONENTS, SIDEBAR_TYPE_ICONS } from '@components/Sidebar/sidebarTheme';
import { setupMonacoEnvironment } from '@utils/monacoWorkerSetup';
import VariablesPanel from './VariablesPanel';
import { useAIProvider } from '@context/AIProviderContext';
import { useProjectData, useProjectDataUpdate } from '@context/ProjectDataContext';
// Note: ScriptManagerService handles ExecCode/UICode conversion internally
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
  isGenerating?: boolean; // ✅ Flag for AI generation loading state
  onSave?: (script: string) => void; // ✅ Callback when script is saved
  edgeId?: string; // ✅ Edge ID for error removal
  conditionId?: string; // ✅ Condition ID (if edge is linked)
  registerOnClose?: (fn: () => Promise<boolean>) => void; // ✅ NEW: Register close handler for dock tab
}

// ✅ REFACTOR: Use domain function
import { listKeys, flattenVariablesTree, filterVariablesTree, findDuplicateGroups, extractUsedVariables, filterVariablesForTester } from './domain/variablesDomain';
import { normalizeCode, parseTemplate, synthesizeDateVariables, fixDateAliases } from './domain/scriptDomain';
import { ConditionAIService } from './application/ConditionAIService';
import { ScriptManagerService } from './application/ScriptManagerService';
import { VariablesIntellisenseService } from './application/VariablesIntellisenseService';
import { useConditionEditorState } from './hooks/useConditionEditorState';
import { useVariablesIntellisense } from './hooks/useVariablesIntellisense';
import { ConditionEditorHeader } from './presentation/ConditionEditorHeader';
import { DSLEditor } from './dsl/editor/DSLEditor';

// No local template; EditorPanel injects the scaffold

export default function ConditionEditor({ open, onClose, variables, initialScript, dockWithinParent, variablesTree, label, onRename, isGenerating = false, onSave, edgeId, conditionId, registerOnClose }: Props) {
  const [nl, setNl] = React.useState('');
  // ✅ RIMOSSO: DEFAULT_CODE - ora usiamo stringa vuota
  const DEFAULT_CODE = ''; // Stringa vuota invece del testo di esempio

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
    editorMode, setEditorMode,
    compiledJs, setCompiledJs,
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

  // ✅ FIX: Track conditionId locally — updated after createCondition
  const localConditionIdRef = React.useRef<string | undefined>(conditionId);
  React.useEffect(() => {
    localConditionIdRef.current = conditionId;
  }, [conditionId]);

  // ✅ FIX: Always keep scriptManagerRef current (avoids stale closure and race conditions)
  const scriptManagerRef = React.useRef(scriptManager);
  scriptManagerRef.current = scriptManager;

  /**
   * Ref tracking the currently in-flight auto-save promise.
   * Used as a mutex: saveCurrentScriptBeforeClose awaits this before proceeding
   * to avoid the race where two concurrent createCondition calls overwrite each other.
   */
  const pendingSaveRef = React.useRef<Promise<void> | null>(null);

  const updateProjectDataScript = React.useCallback(async (dslToSave: string) => {
    // ✅ MUTEX: Create a promise that resolves when this save finishes.
    // saveCurrentScriptBeforeClose will await this before proceeding.
    let finalizeSave!: () => void;
    const savePromise = new Promise<void>(res => { finalizeSave = res; });
    pendingSaveRef.current = savePromise;

    try {
      const currentConditionId = localConditionIdRef.current;

      let result;
      if (currentConditionId) {
        result = await scriptManager.saveScript(dslToSave, label || '', currentConditionId);
        if (!result.success && result.errors?.some((e: any) =>
          e.message?.includes('not found') || e.message?.includes('Use createCondition')
        )) {
          // ✅ FIX: Usa conditionId dall'edge se disponibile (mantiene collegamento edge → condition)
          result = await scriptManager.createCondition(dslToSave, label || '', conditionId || currentConditionId);
        }
      } else {
        // ✅ FIX: Usa conditionId dall'edge se disponibile
        result = await scriptManager.createCondition(dslToSave, label || '', conditionId);
      }

      if (result.success && result.conditionId) {
        const wasNewCondition = !currentConditionId;
        localConditionIdRef.current = result.conditionId;

        if (edgeId && wasNewCondition) {
          try {
            const { updateEdgeWithConditionId } = await import('@services/EdgeConditionUpdater');
            updateEdgeWithConditionId(edgeId, result.conditionId);
          } catch (err) {
            console.error('[ConditionEditor] ❌ Error updating edge on auto-save', err);
          }
        }
      }

      // Update compiled JS preview
      const compileResult = await scriptManager.compileDSL(dslToSave);
      if (compileResult.success && compileResult.jsCode) {
        setCompiledJs(compileResult.jsCode);
      }
    } finally {
      // Resolve the mutex promise so saveCurrentScriptBeforeClose can proceed
      finalizeSave();
      if (pendingSaveRef.current === savePromise) pendingSaveRef.current = null;
    }
  }, [scriptManager, label, setCompiledJs, edgeId]);

  /**
   * Called by the dock tab's X button via editorCloseRefsMap.
   * Waits for any in-flight auto-save (mutex), then persists the current script.
   * Always returns true so the tab can always be closed.
   */
  const saveCurrentScriptBeforeClose = React.useCallback(async (): Promise<boolean> => {
    // ✅ LOG CRITICO: Salvataggio al close
    console.log('[SAVE_ON_CLOSE] 🚀 START', {
      scriptLength: script?.length || 0,
      scriptPreview: script?.substring(0, 50),
      conditionId: localConditionIdRef.current,
      edgeId
    });

    if (pendingSaveRef.current) {
      await pendingSaveRef.current;
    }

    const currentScript = script;
    if (!currentScript?.trim()) {
      console.log('[SAVE_ON_CLOSE] ⏭️ Script vuoto, skip');
      return true;
    }

    const currentConditionId = localConditionIdRef.current;
    let saveResult;
    if (currentConditionId) {
      saveResult = await scriptManagerRef.current.saveScript(currentScript, label || '', currentConditionId);
      if (!saveResult.success && saveResult.errors?.some((e: any) =>
        e.message?.includes('not found') || e.message?.includes('Use createCondition')
      )) {
        // ✅ FIX: Usa conditionId dall'edge se disponibile (mantiene collegamento edge → condition)
        saveResult = await scriptManagerRef.current.createCondition(currentScript, label || '', conditionId || currentConditionId);
      }
    } else {
      // ✅ FIX: Usa conditionId dall'edge se disponibile
      saveResult = await scriptManagerRef.current.createCondition(currentScript, label || '', conditionId);
    }

    if (saveResult.success) {
      if (saveResult.conditionId) {
        localConditionIdRef.current = saveResult.conditionId;
        if (edgeId && !currentConditionId) {
          try {
            const { updateEdgeWithConditionId } = await import('@services/EdgeConditionUpdater');
            updateEdgeWithConditionId(edgeId, saveResult.conditionId);
          } catch (err) {
            console.error('[SAVE_ON_CLOSE] ❌ Error updating edge', err);
          }
        }
      }

      // ✅ LOG CRITICO: Verifica cosa è stato salvato in memoria
      const savedConditionId = saveResult.conditionId || currentConditionId;
      const projectData = (window as any).__projectData;
      const conditions = projectData?.conditions || [];
      let foundSaved = false;
      let hasExecutableCode = false;
      let executableCodeLength = 0;
      for (const cat of conditions) {
        for (const item of (cat.items || [])) {
          if ((item.id || item._id) === savedConditionId) {
            foundSaved = true;
            hasExecutableCode = !!(item as any).expression?.executableCode;
            executableCodeLength = (item as any).expression?.executableCode?.length || 0;
            break;
          }
        }
        if (foundSaved) break;
      }

      console.log('[SAVE_ON_CLOSE] ✅ SUCCESS', {
        conditionId: savedConditionId,
        foundInMemory: foundSaved,
        hasExecutableCode,
        executableCodeLength
      });

      onSave?.(currentScript);
    } else {
      console.error('[SAVE_ON_CLOSE] ❌ FAILED', {
        errors: saveResult.errors,
        conditionId: currentConditionId
      });
    }

    return true;
  }, [script, label, edgeId, onSave]);

  // ✅ Register close handler for dock tab
  React.useEffect(() => {
    if (registerOnClose) {
      registerOnClose(saveCurrentScriptBeforeClose);
    }
  }, [registerOnClose, saveCurrentScriptBeforeClose]);

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

  // Update compiledJs when switching to JavaScript tab
  React.useEffect(() => {
    if (editorMode === 'javascript' && script && !compiledJs) {
      const compileResult = scriptManager.compileDSL(script);
      if (compileResult.success && compileResult.jsCode) {
        setCompiledJs(compileResult.jsCode);
      }
    }
  }, [editorMode, script, compiledJs, scriptManager, setCompiledJs]);

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

  // ✅ REFACTOR: Use useVariablesIntellisense hook
  // Serialize contentEditable helper (needed for intellisense)
  const serializeCE = React.useCallback((): string => {
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
  }, [nl]);

  const intellisense = useVariablesIntellisense({
    variablesTree,
    varsKeys,
    script,
    setScript,
    nl,
    setNl,
    serializeCE,
    scriptCaretRef,
    nlCERef,
    scriptRef,
  });

  const {
    showVarsMenu,
    setShowVarsMenu,
    varsMenuFilter,
    setVarsMenuFilter,
    varsMenuAnchor,
    varsMenuPos,
    varsMenuRef,
    varsMenuHover,
    setVarsMenuHover,
    expandedActs,
    setExpandedActs,
    expandedMains,
    setExpandedMains,
    navEntries,
    navigateIntellisense,
    insertVariableToken,
    toggleAct,
    toggleMain,
  } = intellisense;

  const [varsMenuMaxH] = React.useState<number>(280);

  // ✅ FIX: Only reload when editor opens or conditionId changes — NOT on every projectData update
  // Uses scriptManagerRef to avoid race conditions during createCondition
  React.useEffect(() => {
    if (!open || isGenerating) return;

    const currentConditionId = localConditionIdRef.current;
    const conditionIdFromProp = conditionId;
    const conditionIdToLoad = currentConditionId || conditionIdFromProp;

    // ✅ LOG CRITICO: Caricamento all'apertura
    console.log('[LOAD_ON_OPEN] 🚀 START', {
      conditionId: conditionIdToLoad,
      fromRef: currentConditionId,
      fromProp: conditionIdFromProp
    });

    if (conditionIdToLoad) {
      const loadedScript = scriptManagerRef.current.loadScriptById(conditionIdToLoad);
      if (loadedScript?.trim()) {
        console.log('[LOAD_ON_OPEN] ✅ SUCCESS', {
          conditionId: conditionIdToLoad,
          scriptLength: loadedScript.length,
          scriptPreview: loadedScript.substring(0, 50)
        });
        setScript(loadedScript);
        // Compile DSL → JS for preview
        (async () => {
          const compileResult = await scriptManagerRef.current.compileDSL(loadedScript);
          if (compileResult.success && compileResult.jsCode) {
            setCompiledJs(compileResult.jsCode);
          }
        })();
      } else {
        console.warn('[LOAD_ON_OPEN] ⚠️ NOT FOUND', {
          conditionId: conditionIdToLoad,
          loadedScript: loadedScript
        });
        setScript('');
        setCompiledJs('');
      }
    } else {
      console.log('[LOAD_ON_OPEN] ℹ️ NEW CONDITION (no conditionId)');
      setScript('');
      setCompiledJs('');
    }
  }, [open, conditionId, isGenerating]); // ✅ FIX: scriptManager removed; uses scriptManagerRef

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

  // ✅ NEW: Show loading overlay when generating
  if (isGenerating) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 16,
        color: '#8b5cf6',
        backgroundColor: '#1e1e1e',
      }}>
        <Loader2
          size={32}
          style={{
            color: '#8b5cf6',
            animation: 'spin 1s linear infinite',
          }}
        />
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
        <div style={{ fontSize: 14, fontWeight: 500, color: '#8b5cf6' }}>
          Sto creando la condizione...
        </div>
      </div>
    );
  }

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

  // ✅ REFACTOR: insertVariableToken, toggleAct, toggleMain are now in useVariablesIntellisense hook

  const getDDTIcon = (kind?: string) => {
    try { return getDDTIconFromRE(String(kind || '')); } catch { return null as any; }
  };

  // ✅ REFACTOR: Header extracted to ConditionEditorHeader component

  return (
    <div ref={containerRef} style={{ ...containerStyle, background: 'var(--sidebar-bg, #0b1220)', display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 6, padding: 12, zIndex: 1000 }}>
      {/* Top drag handle for vertical resize */}
      <div onMouseDown={onStartResize} title="Drag to resize" style={{ cursor: 'ns-resize', height: 6, margin: '-12px -12px 6px -12px' }} />
      {/* ✅ REFACTOR: Use ConditionEditorHeader component */}
      <ConditionEditorHeader
        titleValue={titleValue}
        setTitleValue={setTitleValue}
        isEditingTitle={isEditingTitle}
        setIsEditingTitle={setIsEditingTitle}
        headerHover={headerHover}
        setHeaderHover={setHeaderHover}
        titleInputPx={titleInputPx}
        titleInputRef={titleInputRef}
        label={label}
        onRename={onRename}
        onClose={async () => {
          console.log('[ConditionEditor] 🚪 [TRACE] onClose called', {
            timestamp: new Date().toISOString(),
            edgeId,
            label,
            scriptLength: script?.length || 0,
            hasScript: !!(script && script.trim())
          });

          // ✅ Save script before closing (if not empty)
          // Save even if compilation fails - DSL is source of truth
          if (script && script.trim()) {
            // ✅ FIX: Use localConditionIdRef (always up-to-date) instead of conditionId prop (stale)
            const currentConditionId = localConditionIdRef.current;

            console.log('[ConditionEditor] 💾 [TRACE] Attempting to save script on close', {
              timestamp: new Date().toISOString(),
              label,
              conditionIdFromRef: currentConditionId,
              conditionIdFromProp: conditionId,
              edgeId,
              scriptLength: script.length,
              scriptPreview: script.substring(0, 100),
              willUpdate: !!currentConditionId,
              willCreate: !currentConditionId
            });

            // Try to compile for validation, but save even if compilation fails
            const compileResult = await scriptManager.compileDSL(script);
            const hasCompilationErrors = !compileResult.success || compileResult.errors.length > 0;

            if (hasCompilationErrors) {
              console.warn('[ConditionEditor] ⚠️ Compilation errors, but saving DSL anyway', {
                errors: compileResult.errors
              });
            }

            // ✅ FIX: Use currentConditionId from ref (always up-to-date) instead of conditionId prop
            let saveResult;
            if (currentConditionId) {
              // Condition already exists - update it
              saveResult = await scriptManager.saveScript(script, label || '', currentConditionId);
              // If condition not found by ID, create new one (orphaned conditionId)
              if (!saveResult.success && saveResult.errors?.some((e: any) =>
                e.message?.includes('not found') || e.message?.includes('Use createCondition')
              )) {
                console.log('[ConditionEditor] ℹ️ Condition not found by ID, creating new condition', {
                  label,
                  orphanedConditionId: currentConditionId
                });
                const createResult = await scriptManager.createCondition(script, label || '');
                if (createResult.success) {
                  saveResult = createResult;
                  // Update ref with new conditionId
                  if (createResult.conditionId) {
                    localConditionIdRef.current = createResult.conditionId;
                  }
                }
              }
            } else {
              // No conditionId → create new condition
              saveResult = await scriptManager.createCondition(script, label || '');
              // Update ref with new conditionId
              if (saveResult.success && saveResult.conditionId) {
                localConditionIdRef.current = saveResult.conditionId;
              }
            }

            if (saveResult.success) {
              const savedConditionId = saveResult.conditionId || currentConditionId;
              console.log('[ConditionEditor] ✅ [TRACE] Script saved on close', {
                timestamp: new Date().toISOString(),
                label,
                conditionId: savedConditionId,
                dslLength: script.length,
                hasEdgeId: !!edgeId,
                hasCompilationErrors,
                wasCreated: !currentConditionId && !!savedConditionId,
                previousConditionId: currentConditionId
              });

              // ✅ Notify save callback
              onSave?.(script);

              // ✅ FIX: Only update edge if a brand-new condition was just created (no conditionId before)
              // If conditionId already existed, edge should already be linked (updated by auto-save)
              if (edgeId && savedConditionId && !currentConditionId) {
                console.log('[ConditionEditor] 🔗 [TRACE] Updating edge synchronously with conditionId (new condition)', {
                  edgeId,
                  conditionId: savedConditionId,
                  previousConditionId: currentConditionId
                });
                const { updateEdgeWithConditionId } = await import('@services/EdgeConditionUpdater');
                const updated = updateEdgeWithConditionId(edgeId, savedConditionId);
                if (updated) {
                  console.log('[ConditionEditor] ✅ [TRACE] Edge updated successfully on close', {
                    edgeId,
                    conditionId: savedConditionId
                  });
                } else {
                  console.warn('[ConditionEditor] ⚠️ [TRACE] Failed to update edge synchronously on close', {
                    edgeId,
                    conditionId: savedConditionId
                  });
                }
              } else if (edgeId && !savedConditionId) {
                console.warn('[ConditionEditor] ⚠️ [TRACE] Cannot update edge - missing conditionId', {
                  edgeId,
                  hasConditionId: !!saveResult.conditionId,
                  currentConditionId
                });
              } else {
                console.log('[ConditionEditor] ⏭️ [TRACE] Skipping edge update on close', {
                  edgeId,
                  savedConditionId,
                  currentConditionId,
                  reason: !edgeId ? 'no edgeId' : !savedConditionId ? 'no savedConditionId' : 'condition already existed'
                });
              }

              // ✅ Remove errors for this edge if condition is valid (no compilation errors)
              if (edgeId && !hasCompilationErrors) {
                document.dispatchEvent(new CustomEvent('conditionEditor:conditionValidated', {
                  detail: { edgeId, label },
                  bubbles: true
                }));
              }
            } else {
              console.error('[ConditionEditor] ❌ Failed to save script', {
                label,
                conditionId: currentConditionId,
                errors: saveResult.errors
              });
            }
          } else {
            console.log('[ConditionEditor] ⏭️ Skipping save - script is empty', {
              label,
              conditionId: localConditionIdRef.current,
              scriptLength: script?.length || 0
            });
          }
          onClose();
        }}
      />
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
          {/* Code panel - DSL/JavaScript editor with toolbar */}
          {showCode && (
          <div style={{ height: '100%', border: '1px solid #334155', borderRadius: 6, overflow: 'hidden', background: '#0b1220', display: 'grid', gridTemplateRows: 'auto auto 1fr' }}>
            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 4, padding: '4px 8px', borderBottom: '1px solid #334155', background: '#1e293b' }}>
              <button
                onClick={() => setEditorMode('dsl')}
                style={{
                  padding: '4px 12px',
                  background: editorMode === 'dsl' ? '#3b82f6' : 'transparent',
                  color: editorMode === 'dsl' ? '#fff' : '#94a3b8',
                  border: '1px solid',
                  borderColor: editorMode === 'dsl' ? '#3b82f6' : '#334155',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: editorMode === 'dsl' ? 600 : 400,
                }}
              >
                DSL
              </button>
              <button
                onClick={() => setEditorMode('javascript')}
                style={{
                  padding: '4px 12px',
                  background: editorMode === 'javascript' ? '#3b82f6' : 'transparent',
                  color: editorMode === 'javascript' ? '#fff' : '#94a3b8',
                  border: '1px solid',
                  borderColor: editorMode === 'javascript' ? '#3b82f6' : '#334155',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: editorMode === 'javascript' ? 600 : 400,
                }}
                title="Read-only: Generated from DSL"
              >
                JavaScript (read-only)
              </button>
            </div>
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
            {editorMode === 'dsl' ? (
              <DSLEditor
                value={script}
                onChange={async (dsl) => {
                  setScript(dsl);
                  setAiQuestion('');
                  // Compile DSL → JS for preview
                  const compileResult = await scriptManager.compileDSL(dsl);
                  if (compileResult.success && compileResult.jsCode) {
                    setCompiledJs(compileResult.jsCode);
                  }
                  // Auto-save on valid DSL (debounced in DSLEditor)
                  if (compileResult.success && dsl.trim()) {
                    updateProjectDataScript(dsl);
                  }
                }}
                onCompile={(dsl, jsCode, errors) => {
                  setCompiledJs(jsCode);
                  if (errors.length === 0) {
                    updateProjectDataScript(dsl);
                  }
                }}
                variables={variables}
                variablesTree={variablesTree}
                fontSize={fontPx}
              />
            ) : (
              <div style={{ position: 'relative', height: '100%' }}>
                <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, padding: '4px 8px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', borderRadius: 4, fontSize: 11, color: '#93c5fd' }}>
                  Read-only: Generated from DSL
                </div>
                <CodeEditor
                  ref={codeEditorRef}
                  initialCode={compiledJs || '// Compile DSL to see generated JavaScript'}
                  initialMode={'predicate'}
                  fontPx={fontPx}
                  initialVars={(variablesFlat || []).map(k => ({ key: k, type: 'string', description: k, sensitivity: 'public' })) as any}
                  onCodeChange={() => {
                    // Read-only - do nothing
                  }}
                  ai={{
                    // Disabled in JavaScript mode (read-only)
                    codeEditToPatch: async () => '--- a/code\n+++ b/code\n',
                    suggestTestCases: async () => ({}),
                  }}
                  tests={{
                    run: async () => ({ pass: 0, fail: 0, blocked: 0, ms: 0, results: [] })
                  }}
                  onPatchApplied={() => {
                    // Read-only - do nothing
                  }}
                  layout="compact"
                  showGenerateButton={false}
                  onGenerateClick={async () => {
                    // Read-only mode - do nothing
                  }}
                  onTestCasesSuggested={() => {
                    // Read-only mode - do nothing
                  }}
                />
              </div>
            )}
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


