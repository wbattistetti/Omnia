// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useState, useEffect, useMemo } from 'react';

export interface UseConditionEditorStateProps {
  open: boolean;
  initialScript?: string;
  label?: string;
  defaultCode: string;
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
  setShowCode: (value: boolean) => void;
  showTester: boolean;
  setShowTester: (value: boolean) => void;
  showVariablesPanel: boolean;
  setShowVariablesPanel: (value: boolean) => void;

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
  wVars: number;
  setWVars: (value: number) => void;
  wTester: number;
  setWTester: (value: number) => void;
  fontPx: number;
  setFontPx: (value: number) => void;

  // Variables state
  selectedVars: string[];
  setSelectedVars: (vars: string[] | ((prev: string[]) => string[])) => void;

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
}

/**
 * Custom hook that manages all UI state for ConditionEditor.
 * Centralizes state management to reduce component complexity.
 */
export function useConditionEditorState(props: UseConditionEditorStateProps): UseConditionEditorStateReturn {
  const { open, initialScript, label, defaultCode } = props;

  // Script state
  const [script, setScript] = useState(initialScript && initialScript.trim() ? initialScript : defaultCode);
  const [lastAcceptedScript, setLastAcceptedScript] = useState('');
  const [hasCreated, setHasCreated] = useState(false);

  // UI state
  const [busy, setBusy] = useState(false);
  const [aiQuestion, setAiQuestion] = useState<string>('');
  const [showCode, setShowCode] = useState<boolean>(true);
  const [showTester, setShowTester] = useState<boolean>(false);
  const [showVariablesPanel, setShowVariablesPanel] = useState<boolean>(false);

  // Title state
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleValue, setTitleValue] = useState<string>(label || 'Condition');
  const [headerHover, setHeaderHover] = useState<boolean>(false);
  const [titleInputPx, setTitleInputPx] = useState<number>(200);

  // Layout state
  const [heightPx, setHeightPx] = useState<number>(480);
  const [wVars, setWVars] = useState<number>(280);
  const [wTester, setWTester] = useState<number>(360);
  const [fontPx, setFontPx] = useState<number>(13);

  // Variables state
  const [selectedVars, setSelectedVars] = useState<string[]>([]);

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
    setShowVariablesPanel(false);
    setSelectedVars([]);
    setTesterHints({});
    setTestRows([]);
    setHasFailures(false);

    // Reset script to template or provided initialScript when opening a new condition
    const base = (initialScript && initialScript.trim()) ? initialScript : defaultCode;
    setScript(base);
    const created = !!(initialScript && initialScript.trim());
    setHasCreated(created);
    setLastAcceptedScript(created ? String(initialScript) : '');
    setTesterAllPass(null);
    setHeightPx(480);
    setWVars(280);
    setWTester(360);
    setFontPx(13);
  }, [open, initialScript, label, defaultCode]);

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
    showVariablesPanel,
    setShowVariablesPanel,

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
    wVars,
    setWVars,
    wTester,
    setWTester,
    fontPx,
    setFontPx,

    // Variables state
    selectedVars,
    setSelectedVars,

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
  };
}
