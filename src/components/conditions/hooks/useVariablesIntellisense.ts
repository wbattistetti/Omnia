// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { VariablesIntellisenseService } from '../application/VariablesIntellisenseService';
import { filterVariablesTree } from '../domain/variablesDomain';
import type { VarsTreeAct } from '../domain/variablesDomain';
import type { NavEntry } from '../application/VariablesIntellisenseService';

export interface UseVariablesIntellisenseProps {
  variablesTree?: VarsTreeAct[];
  varsKeys: string[];
  script: string;
  setScript: (script: string) => void;
  nl: string;
  setNl: (nl: string) => void;
  serializeCE: () => string;
  scriptCaretRef: React.MutableRefObject<{ start: number; end: number }>;
  nlCERef: React.RefObject<HTMLDivElement>;
  scriptRef: React.RefObject<HTMLTextAreaElement>;
}

export interface UseVariablesIntellisenseReturn {
  showVarsMenu: boolean;
  setShowVarsMenu: (show: boolean) => void;
  varsMenuFilter: string;
  setVarsMenuFilter: (filter: string) => void;
  varsMenuActiveField: 'nl' | 'script' | null;
  varsMenuAnchor: HTMLElement | null;
  varsMenuPos: { left: number; top: number } | null;
  varsMenuRef: React.RefObject<HTMLDivElement>;
  varsMenuHover: boolean;
  setVarsMenuHover: (hover: boolean) => void;
  varsNavIndex: number;
  setVarsNavIndex: (index: number) => void;
  expandedActs: Record<string, boolean>;
  setExpandedActs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  expandedMains: Record<string, boolean>;
  setExpandedMains: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  navEntries: NavEntry[];
  navigateIntellisense: (key: 'ArrowUp' | 'ArrowDown' | 'Enter') => void;
  insertVariableToken: (varKey: string) => void;
  toggleAct: (label: string) => void;
  toggleMain: (actLabel: string, mainLabel: string) => void;
}

/**
 * Custom hook that manages variables intellisense menu state and navigation.
 */
export function useVariablesIntellisense(props: UseVariablesIntellisenseProps): UseVariablesIntellisenseReturn {
  const {
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
  } = props;

  const intellisenseService = useMemo(() => new VariablesIntellisenseService(), []);

  const [showVarsMenu, setShowVarsMenu] = useState(false);
  const [varsMenuFilter, setVarsMenuFilter] = useState('');
  const [varsMenuActiveField] = useState<'nl' | 'script' | null>(null);
  const [varsMenuAnchor] = useState<HTMLElement | null>(null);
  const [varsMenuPos] = useState<{ left: number; top: number } | null>(null);
  const varsMenuRef = useRef<HTMLDivElement>(null);
  const [varsMenuHover, setVarsMenuHover] = useState(false);
  const [varsNavIndex, setVarsNavIndex] = useState(0);
  const [expandedActs, setExpandedActs] = useState<Record<string, boolean>>({});
  const [expandedMains, setExpandedMains] = useState<Record<string, boolean>>({});

  // Filter variables for menu
  const filteredVarsForMenu = useMemo(() => {
    const f = (varsMenuFilter || '').trim().toLowerCase();
    if (!f) return varsKeys;
    return varsKeys.filter(k => k.toLowerCase().includes(f));
  }, [varsKeys, varsMenuFilter]);

  // Filter tree acts
  const filteredTreeActs = useMemo(() => {
    return filterVariablesTree(variablesTree || [], varsMenuFilter);
  }, [variablesTree, varsMenuFilter]);

  // Build navigation entries
  const navEntries = useMemo(() => {
    const result = intellisenseService.buildNavigationEntries(
      variablesTree,
      filteredTreeActs,
      filteredVarsForMenu,
      expandedActs,
      expandedMains
    );
    return result.entries;
  }, [intellisenseService, variablesTree, filteredTreeActs, filteredVarsForMenu, expandedActs, expandedMains]);

  // Navigate intellisense menu
  const navigateIntellisense = useCallback((key: 'ArrowUp' | 'ArrowDown' | 'Enter') => {
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
  }, [varsNavIndex, navEntries, varsMenuActiveField, intellisenseService, script, setScript, nlCERef, scriptRef, scriptCaretRef, setNl, serializeCE, setShowVarsMenu]);

  // Insert variable token
  const insertVariableToken = useCallback((varKey: string) => {
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
  }, [varsMenuActiveField, intellisenseService, script, setScript, nlCERef, scriptRef, scriptCaretRef, setNl, serializeCE, setShowVarsMenu]);

  // Toggle act expansion
  const toggleAct = useCallback((label: string) => {
    setExpandedActs(prev => ({ ...prev, [label]: !prev[label] }));
  }, []);

  // Toggle main expansion
  const toggleMain = useCallback((actLabel: string, mainLabel: string) => {
    const key = `${actLabel}::${mainLabel}`;
    setExpandedMains(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Keyboard navigation effects
  useEffect(() => {
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
        if (navEntries.length > 0) {
          e.preventDefault();
          navigateIntellisense('Enter');
        }
      } else if (key === 'Escape') {
        e.preventDefault();
        setShowVarsMenu(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showVarsMenu, navEntries, varsNavIndex, navigateIntellisense, setShowVarsMenu]);

  // Scroll menu while hovering
  useEffect(() => {
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

  return {
    showVarsMenu,
    setShowVarsMenu,
    varsMenuFilter,
    setVarsMenuFilter,
    varsMenuActiveField,
    varsMenuAnchor,
    varsMenuPos,
    varsMenuRef,
    varsMenuHover,
    setVarsMenuHover,
    varsNavIndex,
    setVarsNavIndex,
    expandedActs,
    setExpandedActs,
    expandedMains,
    setExpandedMains,
    navEntries,
    navigateIntellisense,
    insertVariableToken,
    toggleAct,
    toggleMain,
  };
}
