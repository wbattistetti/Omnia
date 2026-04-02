// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useEffect, useRef } from 'react';
import { convertDSLGUIDsToLabels } from '../../../utils/conditionCodeConverter';
import { createVariableMappings } from '../../../utils/conditionCodeConverter';
import { getActiveFlowCanvasId } from '../../../flows/activeFlowCanvas';
import { useProjectTranslations } from '../../../context/ProjectTranslationsContext';
import { variableCreationService } from '../../../services/VariableCreationService';
import { resolveVariableStoreProjectId } from '../../../utils/safeProjectId';

export interface UseConditionEditorStateProps {
  open: boolean;
  initialScript?: string;
  label?: string;
  defaultCode: string;
  /** Flow canvas for GUID/label mappings when loading script */
  flowCanvasId?: string;
}

export interface UseConditionEditorStateReturn {
  // Script state
  script: string;
  setScript: (script: string) => void;
  lastAcceptedScript: string;
  setLastAcceptedScript: (script: string) => void;
  hasCreated: boolean;
  setHasCreated: (value: boolean) => void;

  // UI state
  busy: boolean;
  setBusy: (value: boolean) => void;
  aiQuestion: string;
  setAiQuestion: (question: string) => void;
  showCode: boolean;
  setShowCode: React.Dispatch<React.SetStateAction<boolean>>;
  showTester: boolean;
  setShowTester: React.Dispatch<React.SetStateAction<boolean>>;

  // Title state
  isEditingTitle: boolean;
  setIsEditingTitle: (value: boolean) => void;
  titleValue: string;
  setTitleValue: (value: string) => void;
  headerHover: boolean;
  setHeaderHover: (value: boolean) => void;
  titleInputPx: number;
  setTitleInputPx: (value: number) => void;

  // Layout state
  heightPx: number;
  setHeightPx: (value: number) => void;
  wTester: number;
  setWTester: (value: number) => void;
  fontPx: number;
  setFontPx: React.Dispatch<React.SetStateAction<number>>;

  // Tester state
  testRows: any[];
  setTestRows: (rows: any[] | ((prev: any[]) => any[])) => void;
  testerHints: { hintTrue?: string; hintFalse?: string; labelTrue?: string; labelFalse?: string };
  setTesterHints: (hints: { hintTrue?: string; hintFalse?: string; labelTrue?: string; labelFalse?: string }) => void;
  testerAllPass: boolean | null;
  setTesterAllPass: (value: boolean | null) => void;
  hasFailures: boolean;
  setHasFailures: (value: boolean) => void;
  pendingDupGroups: Array<{ tail: string; options: string[] }> | null;
  setPendingDupGroups: (groups: Array<{ tail: string; options: string[] }> | null) => void;
  preferredVarByTail: Record<string, string>;
  setPreferredVarByTail: (prefs: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;

  // DSL state
  editorMode: 'dsl' | 'javascript';
  setEditorMode: (mode: 'dsl' | 'javascript') => void;
  compiledJs: string;
  setCompiledJs: (js: string) => void;
}

/**
 * Custom hook that manages all UI state for ConditionEditor.
 * Centralizes state management to reduce component complexity.
 */
export function useConditionEditorState(props: UseConditionEditorStateProps): UseConditionEditorStateReturn {
  const { open, initialScript, label, defaultCode, flowCanvasId } = props;
  const { getTranslation } = useProjectTranslations();

  // Script state
  const [script, setScript] = useState(initialScript && initialScript.trim() ? initialScript : defaultCode);
  const [lastAcceptedScript, setLastAcceptedScript] = useState('');
  const [hasCreated, setHasCreated] = useState(false);

  // DSL state (new)
  const [editorMode, setEditorMode] = useState<'dsl' | 'javascript'>('dsl');
  const [compiledJs, setCompiledJs] = useState<string>('');

  // UI state
  const [busy, setBusy] = useState(false);
  const [aiQuestion, setAiQuestion] = useState<string>('');
  const [showCode, setShowCode] = useState<boolean>(true);
  const [showTester, setShowTester] = useState<boolean>(false);

  // Title state
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleValue, setTitleValue] = useState<string>(label || 'Condition');
  const [headerHover, setHeaderHover] = useState<boolean>(false);
  const [titleInputPx, setTitleInputPx] = useState<number>(200);

  // Layout state
  const [heightPx, setHeightPx] = useState<number>(480);
  const [wTester, setWTester] = useState<number>(360);
  const [fontPx, setFontPx] = useState<number>(13);

  // Tester state
  const [testRows, setTestRows] = useState<any[]>([]);
  const [testerHints, setTesterHints] = useState<{ hintTrue?: string; hintFalse?: string; labelTrue?: string; labelFalse?: string }>({});
  const [testerAllPass, setTesterAllPass] = useState<boolean | null>(null);
  const [hasFailures, setHasFailures] = useState<boolean>(false);
  const [pendingDupGroups, setPendingDupGroups] = useState<Array<{ tail: string; options: string[] }> | null>(null);
  const [preferredVarByTail, setPreferredVarByTail] = useState<Record<string, string>>({});

  // Reset transient UI state whenever the panel is opened
  useEffect(() => {
    if (!open) return;

    setShowCode(true);
    setShowTester(false);
    setAiQuestion('');
    setTesterHints({});
    setTestRows([]);
    setHasFailures(false);

    // Reset script to template or provided initialScript when opening a new condition
    let base = (initialScript && initialScript.trim()) ? initialScript : defaultCode;

    // ✅ Convert GUIDs to labels if initialScript contains GUIDs (human-readable format)
    // This ensures the editor always displays labels, not GUIDs, even if initialScript is passed with GUIDs
    if (base && base.trim() && base !== defaultCode) {
      // Check if script contains GUID pattern: [xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx]
      const GUID_PATTERN = /\[[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\]/i;
      if (GUID_PATTERN.test(base)) {
        // Convert GUIDs to labels for human-readable display
        const fid = flowCanvasId ?? getActiveFlowCanvasId();
        const variableMappings = createVariableMappings(fid);
        const pid = resolveVariableStoreProjectId(
          typeof localStorage !== 'undefined' ? localStorage.getItem('currentProjectId') : null
        );
        base = convertDSLGUIDsToLabels(base, variableMappings, {
          resolveUnknownGuidToLabel: (guid) =>
            getTranslationRef.current(guid) ||
            variableCreationService.getVarNameById(pid, guid) ||
            null,
        });
      }
    }

    setScript(base);
    const created = !!(base && base.trim() && base !== defaultCode);
    setHasCreated(created);
    setLastAcceptedScript(created ? String(base) : '');
    setTesterAllPass(null);
    setHeightPx(480);
    setWTester(360);
    setFontPx(13);
  }, [open, initialScript, label, defaultCode, flowCanvasId]);

  // Sync title when label changes
  useEffect(() => {
    setTitleValue(label || 'Condition');
  }, [label]);

  // Ensure tester cannot be opened before code exists
  useEffect(() => {
    if (!hasCreated && showTester) {
      setShowTester(false);
    }
  }, [hasCreated, showTester]);

  return {
    // Script state
    script,
    setScript,
    lastAcceptedScript,
    setLastAcceptedScript,
    hasCreated,
    setHasCreated,

    // UI state
    busy,
    setBusy,
    aiQuestion,
    setAiQuestion,
    showCode,
    setShowCode,
    showTester,
    setShowTester,

    // Title state
    isEditingTitle,
    setIsEditingTitle,
    titleValue,
    setTitleValue,
    headerHover,
    setHeaderHover,
    titleInputPx,
    setTitleInputPx,

    // Layout state
    heightPx,
    setHeightPx,
    wTester,
    setWTester,
    fontPx,
    setFontPx,

    // Tester state
    testRows,
    setTestRows,
    testerHints,
    setTesterHints,
    testerAllPass,
    setTesterAllPass,
    hasFailures,
    setHasFailures,
    pendingDupGroups,
    setPendingDupGroups,
    preferredVarByTail,
    setPreferredVarByTail,

    // DSL state
    editorMode,
    setEditorMode,
    compiledJs,
    setCompiledJs,
  };
}
