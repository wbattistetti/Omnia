import React from 'react';
import { getDDTIcon as getDDTIconFromRE } from '../ActEditor/ResponseEditor/ddtUtils';
import { generateConditionWithAI, suggestConditionCases, normalizePseudoCode, repairCondition } from '../../services/ai/groq';
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

const listKeys = (vars: VarsMap): string[] => {
  try { return Object.keys(vars || {}).sort(); } catch { return []; }
};

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
  // ✅ Inizializza con DEFAULT_CODE se initialScript è vuoto, così il pulsante appare subito
  const [script, setScript] = React.useState(initialScript && initialScript.trim() ? initialScript : DEFAULT_CODE);

  // Use context directly - much simpler!
  let projectData: any = null;
  let pdUpdate: any = null;
  try {
    projectData = useProjectData().data;
    pdUpdate = useProjectDataUpdate();
  } catch {
    // Provider not available - skip
  }

  // Helper: update projectData with generated script
  const updateProjectDataScript = React.useCallback((scriptToSave: string) => {
    console.log('[ConditionEditor][SAVE] 🚀 START saving script', {
      conditionName: label,
      scriptLength: scriptToSave?.length || 0,
      scriptPreview: scriptToSave?.substring(0, 200) || ''
    });

    if (!label || !projectData || !pdUpdate) {
      console.warn('[ConditionEditor][SAVE] ⚠️ Missing required data', {
        hasLabel: !!label,
        hasProjectData: !!projectData,
        hasPdUpdate: !!pdUpdate
      });
      return;
    }

    // ✅ Convert label → GUID before saving (language-independent)
    console.log('[ConditionEditor][SAVE] 🔄 Converting label → GUID before save');
    const scriptWithGuids = convertScriptLabelsToGuids(scriptToSave);
    console.log('[ConditionEditor][SAVE] ✅ Conversion complete', {
      originalLength: scriptToSave.length,
      convertedLength: scriptWithGuids.length,
      changed: scriptToSave !== scriptWithGuids
    });

    const updatedPd = JSON.parse(JSON.stringify(projectData));
    const conditions = updatedPd?.conditions || [];

    let found = false;
    for (const cat of conditions) {
      for (const item of (cat.items || [])) {
        const itemName = item.name || item.label;
        if (itemName === label) {
          if (!item.data) item.data = {};
          const oldScript = item.data.script || '';
          item.data.script = scriptWithGuids; // ✅ Save with GUIDs
          found = true;
          console.log('[ConditionEditor][SAVE] ✅ Saved script to condition (converted to GUIDs)', {
            conditionName: label,
            itemId: item.id,
            scriptLength: scriptWithGuids.length,
            originalLength: scriptToSave.length,
            oldScriptLength: oldScript.length,
            oldScriptPreview: oldScript.substring(0, 100)
          });
          break;
        }
      }
      if (found) break;
    }

    if (found) {
      pdUpdate.updateDataDirectly(updatedPd);
      console.log('[ConditionEditor][SAVE] ✅ Updated projectData via updateDataDirectly');
    } else {
      console.warn('[ConditionEditor][SAVE] ⚠️ Condition not found in projectData', {
        conditionName: label,
        availableConditions: conditions.flatMap(cat => (cat.items || []).map((item: any) => item.name || item.label))
      });
    }
  }, [label, projectData, pdUpdate]);

  const [busy, setBusy] = React.useState(false);
  const [aiQuestion, setAiQuestion] = React.useState<string>('');
  // describe/chat removed
  const [showCode, setShowCode] = React.useState<boolean>(true);
  const [showTester, setShowTester] = React.useState<boolean>(false);
  const [hasCreated, setHasCreated] = React.useState<boolean>(false);
  const monacoEditorRef = React.useRef<any>(null);
  const monacoInstanceRef = React.useRef<typeof monacoNS | null>(null);
  const codeEditorRef = React.useRef<CodeEditorRef>(null);
  React.useEffect(() => { try { monacoInstanceRef.current = (window as any).monaco || null; } catch {} }, []);
  const [runtimeErrorMsg, setRuntimeErrorMsg] = React.useState<string | null>(null);
  // clarification answer input will be handled inline; no separate state
  const varsKeys = React.useMemo(() => listKeys(variables), [variables]);
  // deprecated flat filter (kept for past API) — not used
  const nlCERef = React.useRef<HTMLDivElement>(null);
  const scriptRef = React.useRef<HTMLTextAreaElement>(null);
  const scriptCaretRef = React.useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const [isEditingTitle, setIsEditingTitle] = React.useState<boolean>(false);
  const [titleValue, setTitleValue] = React.useState<string>(label || 'Condition');
  React.useEffect(() => { setTitleValue(label || 'Condition'); }, [label]);
  const [headerHover, setHeaderHover] = React.useState<boolean>(false);
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const titleMeasureRef = React.useRef<HTMLSpanElement>(null);
  const [titleInputPx, setTitleInputPx] = React.useState<number>(200);
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
  const [heightPx, setHeightPx] = React.useState<number>(480);
  const containerRef = React.useRef<HTMLDivElement>(null);
  // Panel widths (Chat, Variables, Tester have fixed px; Code flexes)
  const [wVars, setWVars] = React.useState<number>(280);
  const [wTester, setWTester] = React.useState<number>(360);
  const [testRows, setTestRows] = React.useState<CaseRow[]>([]);
  const [pendingDupGroups, setPendingDupGroups] = React.useState<Array<{ tail: string; options: string[] }> | null>(null);
  // Variable selection (checkboxes on the left)
  const [selectedVars, setSelectedVars] = React.useState<string[]>([]);
  const [showVariablesPanel, setShowVariablesPanel] = React.useState<boolean>(false);
  const [testerHints, setTesterHints] = React.useState<{ hintTrue?: string; hintFalse?: string; labelTrue?: string; labelFalse?: string }>({});
  // Tester toolbar moved to main toolbar; own run/add controls here
  // Unified font size across all subpanels; Ctrl+Wheel handled at container level
  const [fontPx, setFontPx] = React.useState<number>(13);
  // chat removed
  // Use global AI provider from context
  const { provider } = useAIProvider();

  const normalizeCode = React.useCallback((txt: string) => {
    try { return String(txt || '').replace(/\r/g, '').trim(); } catch { return ''; }
  }, []);

  // Reset transient UI state whenever the panel is opened
  React.useEffect(() => {
    if (!open) return;
    setShowCode(true);
    setShowTester(false);
    // chat removed
    setAiQuestion('');
    setShowVariablesPanel(false);
    setSelectedVars([]);
    setTesterHints({});
    setTestRows([]);
    setHasFailures(false);
    try { getFailuresRef.current = () => []; hasFailuresRef.current = () => false; resetTesterVisualsRef.current = () => {}; markNotesAsUsedRef.current = () => {}; } catch {}
    // ✅ Reset script to template or provided initialScript when opening a new condition
    console.log('[LOAD_SCRIPT] 🔍 Opening editor', {
      conditionName: label,
      hasInitialScript: !!initialScript,
      initialScriptLength: initialScript?.length || 0,
      initialScriptPreview: initialScript?.substring(0, 50) || ''
    });
    const base = (initialScript && initialScript.trim()) ? initialScript : DEFAULT_CODE;
    setScript(base);
    const created = !!(initialScript && initialScript.trim());
    setHasCreated(created);
    setLastAcceptedScript(created ? String(initialScript) : '');
    setTesterAllPass(null);
    setHeightPx(480);
    setWVars(280);
    setWTester(360);
    setFontPx(13);
    // no local tester toolbar state
  }, [open, initialScript, label]); // ✅ Aggiunto initialScript e label alle dipendenze

  // Ensure tester cannot be opened before code exists
  React.useEffect(() => {
    if (!hasCreated && showTester) setShowTester(false);
  }, [hasCreated]);

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
  const filteredTreeActs = React.useMemo(() => {
    const q = (varsMenuFilter || '').trim().toLowerCase();
    if (!q) return variablesTree || [];
    const match = (label?: string) => String(label || '').toLowerCase().includes(q);
    const res: VarsTreeAct[] = [];
    (variablesTree || []).forEach(act => {
      const mains: VarsTreeMain[] = [];
      (act.mains || []).forEach(m => {
        const subs: VarsTreeSub[] = [];
        (m.subs || []).forEach(s => { if (match(`${act.label}.${m.label}.${s.label}`) || match(s.label)) subs.push(s); });
        if (subs.length || match(`${act.label}.${m.label}`) || match(m.label)) mains.push({ ...m, subs });
      });
      if (mains.length || match(act.label)) res.push({ ...act, mains });
    });
    return res;
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

  // Flatten variables for AI prompt
  const variablesFlat = React.useMemo(() => {
    if (variablesTree && variablesTree.length) {
      const out: string[] = [];
      (variablesTree || []).forEach(a => {
        (a.mains || []).forEach(m => {
          out.push(`${a.label}.${m.label}`);
          (m.subs || []).forEach(s => out.push(`${a.label}.${m.label}.${s.label}`));
        });
      });
      return out;
    }
    return Object.keys(variables || {});
  }, [variablesTree, variables]);

  // Variables actually referenced inside the script (robust multi-source detection)
  const usedVarsInScript = React.useMemo(() => {
    try {
      const source = String(script || '');

      // 1) CONDITION.inputs (priority — if present, we will return ONLY these later)
      const inputs: string[] = [];
      try {
        const inputsBlockMatch = source.match(/CONDITION[\s\S]*?inputs\s*:\s*\[([\s\S]*?)\]/m);
        if (inputsBlockMatch) {
          const block = inputsBlockMatch[1] || '';
          const singleQuoted = Array.from(block.matchAll(/'([^']+)'/g)).map(m => m[1]);
          const doubleQuoted = Array.from(block.matchAll(/"([^"]+)"/g)).map(m => m[1]);
          const backticked = Array.from(block.matchAll(/`([^`]+)`/g)).map(m => m[1]);
          const ordered: string[] = [];
          const once = new Set<string>();
          [...singleQuoted, ...doubleQuoted, ...backticked].forEach(k => { if (!once.has(k)) { once.add(k); ordered.push(k); } });
          inputs.push(...ordered);
        }
      } catch {}

      // 2) Other reads — union of explicit patterns
      const reads = new Set<string>();

      // 2a) getVar(ctx, "...")
      try {
        const re = /getVar\s*\(\s*ctx\s*,\s*(["'`])([^"'`]+)\1\s*\)/g;
        let mm: RegExpExecArray | null;
        while ((mm = re.exec(source)) !== null) reads.add(mm[2]);
      } catch {}

      // 2b) ctx["..."] direct
      try {
        const re = /ctx\s*\[\s*(["'`])([^"'`]+)\1\s*\]/g;
        let mm: RegExpExecArray | null;
        while ((mm = re.exec(source)) !== null) reads.add(mm[2]);
      } catch {}

      // 2c) const k = "..." ; then ctx[k] (1-step constant propagation)
      try {
        const constMap = new Map<string, string>();
        const constDeclRe = /const\s+([A-Za-z_$][\w$]*)\s*=\s*(["'`])([^"'`]+)\2\s*;?/g;
        let mm: RegExpExecArray | null;
        while ((mm = constDeclRe.exec(source)) !== null) {
          constMap.set(mm[1], mm[3]);
        }
        if (constMap.size > 0) {
          const ctxIdRe = /ctx\s*\[\s*([A-Za-z_$][\w$]*)\s*\]/g;
          let m2: RegExpExecArray | null;
          while ((m2 = ctxIdRe.exec(source)) !== null) {
            const idName = m2[1];
            const value = constMap.get(idName);
            if (value) reads.add(value);
          }
        }
      } catch {}

      // 2d) legacy vars["..."]
      try {
        const re = /vars\s*\[\s*(["'`])([^"'`]+)\1\s*\]/g;
        let mm: RegExpExecArray | null;
        while ((mm = re.exec(source)) !== null) reads.add(mm[2]);
      } catch {}

      // Return priority set: CONDITION.inputs if present, else union reads
      if (inputs.length > 0) return inputs;
      return Array.from(reads);
    } catch {
      return [];
    }
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

  // Variables to show inside the tester: strictly and only those actually read by the code
  // Deduplicate case-insensitively to avoid duplicates with different casing
  const variablesForTester = React.useMemo(() => {
    const usedArr = (variablesUsedInScript || []).filter(Boolean);
    const seen = new Set<string>();
    const out: string[] = [];
    usedArr.forEach((k) => {
      const lc = String(k).toLowerCase();
      if (!seen.has(lc)) { seen.add(lc); out.push(k); }
    });
    // If multiple remain but the script logically handles a single input, prefer the first
    return out.length > 1 ? [out[0]] : out;
  }, [variablesUsedInScript]);

  // Duplicate-variable preference (choose among same trailing label)
  const [preferredVarByTail, setPreferredVarByTail] = React.useState<Record<string, string>>({});
  const duplicateGroups = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    variablesFlat.forEach(full => {
      const tail = full.split('.').slice(-2).join('.') || full;
      map[tail] = map[tail] ? [...map[tail], full] : [full];
    });
    const dups: Array<{ tail: string; options: string[] }> = [];
    Object.keys(map).forEach(tail => { if ((map[tail] || []).length > 1) dups.push({ tail, options: map[tail] }); });
    return dups;
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
  const testerRunRef = React.useRef<() => void>(() => {});
  const [testerAllPass, setTesterAllPass] = React.useState<boolean | null>(null);
  const handleAddTestLine = React.useRef<() => void>(() => {});
  const getFailuresRef = React.useRef<() => Array<any>>(() => []);
  const hasFailuresRef = React.useRef<() => boolean>(() => false);
  const resetTesterVisualsRef = React.useRef<() => void>(() => {});
  const markNotesAsUsedRef = React.useRef<() => void>(() => {});
  const resetTesterVisuals = React.useCallback(() => {
    setTesterAllPass(null);
    // Clear any previous not-passed comments by resetting test rows labels only
    setTestRows(prev => prev.map(r => ({ ...r })));
  }, []);
  const [hasFailures, setHasFailures] = React.useState<boolean>(false);
  const [lastAcceptedScript, setLastAcceptedScript] = React.useState<string>('');

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

  const modify = async () => {
    setBusy(true);
    try {
      const norm = await normalizePseudoCode({
        chat: [] as any,
        pseudo: script || '',
        currentCode: lastAcceptedScript || '',
        variables: variablesFlatWithPreference,
        mode: 'predicate',
        provider: (window as any).__AI_PROVIDER || undefined,
        label: titleValue
      });
      const candidate = (norm as any)?.script;
      if (candidate && typeof candidate === 'string' && candidate.trim()) {
        setScript(candidate);
        updateProjectDataScript(candidate);
        setHasCreated(true);
        setLastAcceptedScript(candidate);
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
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    const nlText = script;
    if (!nlText) { setAiQuestion('Inserisci una descrizione in linguaggio naturale.'); return; }
    if (!variablesFlatWithPreference || variablesFlatWithPreference.length === 0) {
      setAiQuestion('Nessuna variabile disponibile: controlla la struttura DDT o le variabili di progetto.');
      return;
    }
    // Parse simplified Italian template with comments and quoted label
    const parseTemplate = (txt: string): { label?: string; when?: string; vars?: string[] } => {
      const src = String(txt || '');
      // label: first quoted line after the first comment
      const mLabel = src.match(/^[ \t]*\/\/\s*Puoi cambiare[^\n]*\n[ \t]*"([^"]*)"/m);
      const label = mLabel ? mLabel[1].trim() : undefined;
      // when: text between the second and third comment blocks
      const mWhen = src.match(/\/\/\s*Descrivi[^\n]*\n([\s\S]*?)\n\/\/\s*Indica\s*o\s*descrivi/i);
      const when = mWhen ? mWhen[1].trim() : undefined;
      return { label, when, vars: undefined };
    };
    const parsed = parseTemplate(nlText);
    if (!parsed.when) {
      // If user wrote any non-empty line after the second comment, still proceed using entire editor content as pseudo
      const hasAnyContent = /\S/.test(nlText.replace(/^\s*\/\/[^\n]*$/gm, ''));
      if (!hasAnyContent) {
        setAiQuestion('Compila la sezione sotto: "Descrivi qui sotto in modo dettagliato quando la condizione è true".');
        return;
      }
      parsed.when = nlText.trim();
    }
    if (parsed.label && parsed.label !== titleValue) setTitleValue(parsed.label);
    // If there are duplicate groups relevant to this condition and no preference chosen yet, request a selection
    const nlNorm = parsed.when.toLowerCase();
    const relevant = duplicateGroups.filter(g => {
      const tailText = g.tail.split('.').slice(-2).join(' ').toLowerCase();
      return nlNorm.includes(tailText) || nlNorm.includes(g.tail.toLowerCase());
    });
    const missingChoice = relevant.filter(g => !preferredVarByTail[g.tail]);
    if (relevant.length > 0 && missingChoice.length > 0) {
      setPendingDupGroups(relevant);
      setAiQuestion('Seleziona la variabile corretta per la condizione.');
      return; // stop here; user will choose and cliccare Create di nuovo
    } else {
      setPendingDupGroups(null);
    }
    setBusy(true);
    try {
      // 1) Try normalize pseudo+chat+current code into clean JS
      try {
        const allowedVars = (parsed.vars && parsed.vars.length > 0) ? parsed.vars : ((selectedVars && selectedVars.length > 0) ? selectedVars : variablesFlatWithPreference);
        const norm = await normalizePseudoCode({
          chat: [] as any,
          pseudo: parsed.when || '',
          currentCode: '',
          variables: allowedVars,
          mode: 'predicate',
          provider: (window as any).__AI_PROVIDER || undefined,
          label: parsed.label || titleValue
        });
        const candidate = (norm as any)?.script;
        if (candidate && typeof candidate === 'string' && candidate.trim()) {
          setScript(candidate);
          updateProjectDataScript(candidate);
          setShowCode(true);
          setHasCreated(true);
          setLastAcceptedScript(candidate);
          setShowTester(true);
          setAiQuestion('');
          // Format after normalize
          setTimeout(() => {
            try {
              codeEditorRef.current?.format();
            } catch (e) {
              console.warn('[ConditionEditor] Format failed:', e);
            }
          }, 300);
          return; // success path
        }
      } catch (e) {
      }

      // 2) Fallback to previous condition generator
      const varsForAI = (selectedVars && selectedVars.length > 0) ? selectedVars : variablesFlatWithPreference;
      const varsList = (varsForAI || []).map(v => `- ${v}`).join('\n');
      const guidance = `${nlText}\n\nConstraints:\n- Use EXACTLY these variable keys when reading input; do not invent or rename keys.\n${varsList}\n- Access variables strictly as vars["<key>"] (no dot access).\n- Return a boolean (predicate).\n\nPlease return well-formatted JavaScript for function main(ctx) with detailed inline comments explaining each step and rationale. Use clear variable names, add section headers, and ensure readability (one statement per line).`;
      const out = await generateConditionWithAI(guidance, varsForAI);
      const aiLabel = (out as any)?.label as string | undefined;
      const aiScript = (out as any)?.script as string | undefined;
      const question = (out as any)?.question as string | undefined;
      if (question && !aiScript) {
        setAiQuestion(question);
        return;
      }
      setAiQuestion('');
      if (!titleValue || titleValue === 'Condition') setTitleValue(aiLabel || 'Nuova condizione');
      let nextScript = aiScript || 'try { return false; } catch { return false; }';
      // Post-fix common alias mistakes (e.g., Act.DOB) by rewriting to the selected Date key when unique
      try {
        const all = varsForAI || [];
        const dateCandidates = all.filter(k => /date of birth/i.test(k) || /\.Date$/.test(k));
        if (dateCandidates.length === 1) {
          const target = dateCandidates[0].replace(/"/g, ''); // guard
          const patterns = [
            /vars\[\s*(["'`])Act\.?DOB\1\s*\]/gi,
            /vars\[\s*(["'`])DateOfBirth\1\s*\]/gi,
            /vars\[\s*(["'`])DOB\1\s*\]/gi,
            /vars\[\s*(["'`])Act\.?DateOfBirth\1\s*\]/gi
          ];
          patterns.forEach(re => { nextScript = nextScript.replace(re, `vars["${target}"]`); });
        }
      } catch {}
      setScript(nextScript);
      // Ensure CodeEditor receives the new script immediately even if Diff is empty
      // by toggling showCode on and syncing initialCode via prop (handled by CodeEditor effect)
      setShowCode(true);
      setHasCreated(true);
      setLastAcceptedScript(nextScript);
      // Open tester to the right as requested
      setShowTester(true);
      // Format after AI generates - wait longer for Monaco to be ready
      setTimeout(() => {
        try {
          codeEditorRef.current?.format();
        } catch (e) {
          console.warn('[ConditionEditor] Format failed:', e);
        }
      }, 300);
      // Ask backend to suggest example true/false cases (now handled by CodeEditor's suggestTestCases)
      // But we still call it here for backward compatibility and to populate testRows immediately
      try {
        const cases = await suggestConditionCases(nlText, varsForAI);
        const rows: CaseRow[] = [];
        const synth = (varsIn: Record<string, any> | undefined): Record<string, any> | undefined => {
          if (!varsIn) return varsIn;
          const out = { ...varsIn };
          // If script uses a composite date like "...Date" but AI suggested Year/Month/Day, synth ISO date
          variablesUsedInScript.forEach((k) => {
            if (out[k]) return;
            const base = k.endsWith('.Date') ? k.slice(0, -('.Date'.length)) : '';
            if (!base) return;
            const y = out[`${base}.Date.Year`] ?? out[`${base}.Year`];
            const m = out[`${base}.Date.Month`] ?? out[`${base}.Month`];
            const d = out[`${base}.Date.Day`] ?? out[`${base}.Day`];
            if (y != null && m != null && d != null) {
              const mm = String(m).padStart(2, '0');
              const dd = String(d).padStart(2, '0');
              out[k] = `${y}-${mm}-${dd}`;
            }
          });
          return out;
        };
        if (cases.trueCase) rows.push({ id: String(Math.random()), label: 'true', vars: synth(cases.trueCase) || cases.trueCase });
        if (cases.falseCase) rows.push({ id: String(Math.random()), label: 'false', vars: synth(cases.falseCase) || cases.falseCase });
        if (rows.length) setTestRows(rows);
        setTesterHints({ hintTrue: (cases as any).hintTrue, hintFalse: (cases as any).hintFalse, labelTrue: (cases as any).labelTrue, labelFalse: (cases as any).labelFalse });
      } catch {}
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

  // Insert selected variable token at the caret for the active field
  const insertVariableToken = (varKey: string) => {
    const target = varsMenuActiveField === 'nl' ? (nlCERef.current as any) : scriptRef.current;
    if (!target) return;

    const isScript = varsMenuActiveField === 'script';
    const token = isScript ? `vars["${varKey}"]` : `{${varKey}}`;

    if (varsMenuActiveField === 'nl') {
      // Insert a non-editable chip into contenteditable; use execCommand so undo/redo works
      try {
        (target as HTMLElement).focus();
        const html = `<span data-token="1" contenteditable="false" style="padding:2px 6px;border-radius:6px;border:1px solid #38bdf8;background:rgba(56,189,248,0.15);color:#e5e7eb;font-weight:700;">${token}</span>&nbsp;`;
        // eslint-disable-next-line deprecation/deprecation
        document.execCommand('insertHTML', false, html);
        setNl(serializeCE());
      } catch {}
    } else if (varsMenuActiveField === 'script') {
      const current = script;
      const caretStart = (scriptCaretRef.current?.start ?? (current.length));
      const caretEnd = (scriptCaretRef.current?.end ?? caretStart);
      const next = current.slice(0, caretStart) + token + current.slice(caretEnd);
      setScript(next);
      setTimeout(() => {
        try {
          target.focus();
          const pos = caretStart + token.length;
          (target as any).setSelectionRange(pos, pos);
          scriptCaretRef.current = { start: pos, end: pos };
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
                          const resp = await repairCondition(script, failures, variablesForTester, (window as any).__AI_PROVIDER || undefined);
                          if (resp?.script && typeof resp.script === 'string') {
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
                            const err = (resp as any)?.error || 'repair_failed';
                            setAiQuestion('Repair failed: ' + String(err));
                          }
                        } catch {}
                        finally { setBusy(false); }
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
                    const resp = await repairCondition(script, failures, variablesForTester, (window as any).__AI_PROVIDER || undefined);
                    if (resp?.script && typeof resp.script === 'string') {
                      // Generate diff for repair
                      const diff = await (async () => {
                        const a = script.replace(/\r/g, '');
                        const b = resp.script.replace(/\r/g, '');
                        if (a === b) return '--- a/code\n+++ b/code\n';
                        return `--- a/code\n+++ b/code\n@@ -1,1 +1,1 @@\n-${a}\n+${b}`;
                      })();
                      // Trigger diff in CodeEditor by calling onPatchApplied with the diff
                      // Actually, we need to expose a way to set diff in CodeEditor
                      // For now, set script directly and CodeEditor will sync
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
                      const err = (resp as any)?.error || 'repair_failed';
                      setAiQuestion('Repair failed: ' + String(err));
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


