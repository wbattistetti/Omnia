import React, { forwardRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, Pencil, Trash2 } from 'lucide-react';
import { getMainNodes, getNodeLabel, getSubNodes } from '@responseEditor/core/domain';
import { useTaskTreeStore, useTaskTreeVersion } from '@responseEditor/core/state';
import getIconComponent from '@responseEditor/icons';
import styles from '@responseEditor/ResponseEditor.module.css';
import { useFontContext } from '@context/FontContext';
import { useProjectTranslations } from '@context/ProjectTranslationsContext';
import ParserStatusRow from '@responseEditor/Sidebar/ParserStatusRow';
import type { EngineType } from '@types/semanticContract';
import { getNodeIdStrict } from '@responseEditor/core/domain/nodeStrict';
import type { TaskWizardMode } from '@taskEditor/EditorHost/types';
import { getNodeByPath } from '@responseEditor/core/taskTree';
import { SidebarNestedList } from '@responseEditor/Sidebar/SidebarNestedList';
import { dropPlacementFromEvent, useSidebarDropIndicator } from '@responseEditor/Sidebar/useSidebarDropIndicator';
import type { SelectPathHandler } from '@responseEditor/features/node-editing/selectPathTypes';
import { SidebarInlineEditInput } from '@responseEditor/Sidebar/SidebarInlineEditInput';
import {
  sidebarLabelWidthMode,
  sidebarMainEditKey,
  sidebarPathEditKey,
  sidebarSubEditKey,
} from '@responseEditor/Sidebar/sidebarLabelEditWidth';
import { SIDEBAR_ROW_LABEL_INPUT_STYLE } from '@responseEditor/Sidebar/sidebarRowLabelInputStyle';
import { SIDEBAR_CONTENT_MIN_WIDTH_PX } from '@responseEditor/Sidebar/sidebarLayoutConstants';

function pathKey(path: number[]): string {
  return path.join(':');
}

/** Same roots as useTaskTreeDerived/mainList, read synchronously from the store (no prop lag). */
function getMainListFromTaskTreeStore(): any[] {
  const tree = useTaskTreeStore.getState().taskTree;
  return getMainNodes(tree);
}

interface SidebarProps {
  mainList: any[];
  selectedMainIndex: number;
  onSelectMain: (idx: number) => void;
  selectedSubIndex?: number | null;
  onSelectSub?: (idx: number | undefined, mainIdx?: number) => void;
  aggregated?: boolean;
  rootLabel?: string;
  /** Persisted as TaskTree.aggregateLabel — multiple roots only. */
  onRenameAggregateLabel?: (label: string) => void;
  onSelectAggregator?: () => void;
  onChangeSubRequired?: (mainIdx: number, subIdx: number, required: boolean) => void;
  onReorderSub?: (mainIdx: number, fromIdx: number, toIdx: number) => void; // reorder only within same main
  onAddMain?: (label: string) => void;
  onRenameMain?: (mainIdx: number, label: string) => void;
  onDeleteMain?: (mainIdx: number) => void;
  onAddSub?: (mainIdx: number, label: string) => void;
  onRenameSub?: (mainIdx: number, subIdx: number, label: string) => void;
  onDeleteSub?: (mainIdx: number, subIdx: number) => void;
  onWidthChange?: (width: number) => void; // ✅ Nuova prop per resize manuale
  style?: React.CSSProperties; // ✅ Prop per larghezza manuale
  // ✅ NEW: Parser-related props
  onParserCreate?: (nodeId: string, node: any) => void;
  onParserModify?: (nodeId: string, node: any) => void;
  onEngineChipClick?: (nodeId: string, node: any, engineType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings') => void;
  onGenerateAll?: () => void; // ✅ Pulsante globale Generate All
  // ✅ NEW: Wizard mode to conditionally render overlay
  taskWizardMode?: TaskWizardMode;
  // ✅ NEW: Props per pulsanti conferma struttura (Wizard)
  showStructureConfirmation?: boolean;
  onStructureConfirm?: () => void;
  onStructureReject?: () => void;
  structureConfirmed?: boolean;
  /** Full selection path (optional; falls back to main/sub indices). */
  selectedPath?: number[];
  onSelectPath?: SelectPathHandler;
  onReorderMain?: (fromIdx: number, toIdx: number) => void;
  onAddChildAtPath?: (parentPath: number[] | null, label: string) => void;
  /** When set, nested sub-trees use path-based reorder/rename/delete (manual task tree). */
  onReorderAtPath?: (parentPath: number[] | null, fromIdx: number, toIdx: number) => void;
  onRenameAtPath?: (path: number[], label: string) => void;
  onDeleteAtPath?: (path: number[]) => void;
  onChangeRequiredAtPath?: (path: number[], required: boolean) => void;
  /** Aggregator/root row selected — disables nested "Add child" when true. */
  selectedRoot?: boolean;
}

function pathsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function SidebarComponent(props: SidebarProps, ref: React.ForwardedRef<HTMLDivElement>) {
  // Destructure props to avoid Babel parser issues with long parameter lists
  const mainList = props.mainList;
  const selectedMainIndex = props.selectedMainIndex;
  const onSelectMain = props.onSelectMain;
  const selectedSubIndex = props.selectedSubIndex;
  const onSelectSub = props.onSelectSub;
  const aggregated = props.aggregated;
  const rootLabel = props.rootLabel || 'Data';
  const onRenameAggregateLabel = props.onRenameAggregateLabel;
  const onSelectAggregator = props.onSelectAggregator;
  const onChangeSubRequired = props.onChangeSubRequired;
  const onReorderSub = props.onReorderSub;
  const onAddMain = props.onAddMain;
  const onRenameMain = props.onRenameMain;
  const onDeleteMain = props.onDeleteMain;
  const onAddSub = props.onAddSub;
  const onRenameSub = props.onRenameSub;
  const onDeleteSub = props.onDeleteSub;
  const onWidthChange = props.onWidthChange;
  const style = props.style;
  const onParserCreate = props.onParserCreate;
  const onParserModify = props.onParserModify;
  const onEngineChipClick = props.onEngineChipClick;
  const onGenerateAll = props.onGenerateAll;
  const taskWizardMode = props.taskWizardMode; // ✅ NEW: Get taskWizardMode prop
  // ✅ NEW: Props per pulsanti conferma struttura
  const showStructureConfirmation = props.showStructureConfirmation ?? false;
  const onStructureConfirm = props.onStructureConfirm;
  const onStructureReject = props.onStructureReject;
  const structureConfirmed = props.structureConfirmed ?? false;
  const selectedPathProp = props.selectedPath;
  const onSelectPath = props.onSelectPath;
  const onReorderMain = props.onReorderMain;
  const onAddChildAtPath = props.onAddChildAtPath;
  const onReorderAtPath = props.onReorderAtPath;
  const onRenameAtPath = props.onRenameAtPath;
  const onDeleteAtPath = props.onDeleteAtPath;
  const onChangeRequiredAtPath = props.onChangeRequiredAtPath;
  const selectedRoot = props.selectedRoot;

  const useNestedTree = Boolean(onReorderAtPath && onRenameAtPath && onDeleteAtPath && onChangeRequiredAtPath);

  const { combinedClass } = useFontContext();
  const { translations } = useProjectTranslations(); // ✅ Get translations for node labels
  // Keep a stable ref so useMemo/useLayoutEffect don't re-run when the context
  // returns a new object reference with the same content.
  const translationsRef = React.useRef(translations);
  translationsRef.current = translations;
  const taskTreeVersion = useTaskTreeVersion();
  const dbg = (...args: any[]) => { try { if (localStorage.getItem('debug.sidebar') === '1') console.log(...args); } catch { } };

  // ✅ IMPORTANT: All hooks must be called before any early returns
  // Early return moved to render section to comply with React Hooks rules
  // Pastel/silver palette
  const borderColor = 'rgba(156,163,175,0.65)';
  const bgBase = 'rgba(156,163,175,0.10)';
  const bgActive = 'rgba(156,163,175,0.60)'; // più vivace
  const bgGroup = 'rgba(156,163,175,0.25)'; // highlight gruppo
  const textBase = '#e5e7eb';

  // Include state for mains (UI-only)
  const [includedMains, setIncludedMains] = React.useState<Record<number, boolean>>({});
  const isMainIncluded = (idx: number) => includedMains[idx] !== false;
  const toggleMainInclude = (idx: number, v: boolean) => setIncludedMains(prev => ({ ...prev, [idx]: v }));

  // Expanded state for accordion collapse/expand
  const [expandedMainIndex, setExpandedMainIndex] = React.useState<number | null>(selectedMainIndex);

  /** Path-keyed expansion for nested manual tree (depth > 2). */
  const [expandedPathKeys, setExpandedPathKeys] = React.useState<Set<string>>(() => new Set());
  const { mainDrop, setMainDrop, nestedDrop, setNestedDrop } = useSidebarDropIndicator();
  const nestedDragRef = React.useRef<{ parentKey: string | null; fromIdx: number | null }>({
    parentKey: null,
    fromIdx: null,
  });
  const [editingPath, setEditingPath] = React.useState<number[] | null>(null);
  const hoverPathRefNested = React.useRef<string | null>(null);

  const togglePathExpanded = React.useCallback((path: number[]) => {
    const k = pathKey(path);
    setExpandedPathKeys((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (!useNestedTree || !selectedPathProp?.length) return;
    setExpandedPathKeys((prev) => {
      const next = new Set(prev);
      for (let len = 1; len < selectedPathProp.length; len++) {
        next.add(pathKey(selectedPathProp.slice(0, len)));
      }
      return next;
    });
  }, [selectedPathProp, useNestedTree]);

  // Sync expanded state when external selection changes
  React.useEffect(() => {
    if (selectedMainIndex !== expandedMainIndex) {
      setExpandedMainIndex(selectedMainIndex);
    }
  }, [selectedMainIndex]);

  const safeSelectedSubIndex = typeof selectedSubIndex === 'number' && !isNaN(selectedSubIndex) ? selectedSubIndex : undefined;

  const isMainExpanded = (idx: number) =>
    useNestedTree ? expandedPathKeys.has(pathKey([idx])) : expandedMainIndex === idx;

  const isMainRowActive = (idx: number) =>
    selectedPathProp && selectedPathProp.length > 0
      ? pathsEqual(selectedPathProp, [idx])
      : selectedMainIndex === idx && safeSelectedSubIndex === undefined;

  const isSubRowActive = (mIdx: number, sIdx: number) =>
    selectedPathProp && selectedPathProp.length >= 2
      ? pathsEqual(selectedPathProp, [mIdx, sIdx])
      : selectedMainIndex === mIdx && safeSelectedSubIndex === sIdx;

  // Keyboard navigation between mains and subs
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let handled = false;
    const flatList: Array<{ type: 'main' | 'sub'; mainIdx: number; subIdx?: number }> = [];
    mainList.forEach((main, mIdx) => {
      flatList.push({ type: 'main', mainIdx: mIdx });
      // ✅ NO FALLBACKS: getSubNodes always returns array (can be empty)
      const subs = getSubNodes(main);
      subs.forEach((_, sIdx) => {
        flatList.push({ type: 'sub', mainIdx: mIdx, subIdx: sIdx });
      });
    });
    let currentIdx = flatList.findIndex(item => {
      if (item.type === 'main') return selectedMainIndex === item.mainIdx && (safeSelectedSubIndex === undefined);
      if (item.type === 'sub') return selectedMainIndex === item.mainIdx && safeSelectedSubIndex === item.subIdx;
      return false;
    });
    if (e.key === 'ArrowDown') {
      if (currentIdx < flatList.length - 1) {
        const next = flatList[currentIdx + 1];
        if (next.type === 'main') {
          onSelectMain(next.mainIdx);
          onSelectSub && onSelectSub(undefined);
        } else {
          // ✅ Select both main and sub atomically
          onSelectSub && onSelectSub(next.subIdx!, next.mainIdx);
        }
        handled = true;
      }
    } else if (e.key === 'ArrowUp') {
      if (currentIdx > 0) {
        const prev = flatList[currentIdx - 1];
        if (prev.type === 'main') {
          onSelectMain(prev.mainIdx);
          onSelectSub && onSelectSub(undefined);
        } else {
          // ✅ Select both main and sub atomically
          onSelectSub && onSelectSub(prev.subIdx!, prev.mainIdx);
        }
        handled = true;
      }
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const itemStyle = React.useCallback(
    (active: boolean, _isSub: boolean, disabled?: boolean): React.CSSProperties => ({
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      whiteSpace: 'nowrap',
      background: disabled ? 'rgba(75,85,99,0.25)' : (active ? bgActive : bgBase),
      color: disabled ? '#9ca3af' : textBase,
      border: `1px solid ${borderColor}`,
      borderRadius: 10,
      padding: '8px 10px',
      cursor: 'pointer',
      textAlign: 'left' as const,
      outline: 'none',
      outlineOffset: 0,
      boxShadow: 'none',
      fontWeight: active ? 700 : 400,
      transition: 'border 0.15s',
    }),
    [bgActive, bgBase, textBase, borderColor]
  );

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const dragStateRef = React.useRef<{ mainIdx: number | null; fromIdx: number | null }>({ mainIdx: null, fromIdx: null });
  const mainDragRef = React.useRef<{ fromIdx: number | null }>({ fromIdx: null });

  const assignContainerRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref]
  );
  // ✅ FIX: Calcola larghezza iniziale PRECISA in modo sincrono - deve essere identica al ghost
  // Questo elimina completamente il flash perché la larghezza è già corretta al primo render
  const calculateInitialWidth = React.useMemo(() => {
    if (!Array.isArray(mainList) || mainList.length === 0) return SIDEBAR_CONTENT_MIN_WIDTH_PX;

    // ✅ Usa canvas per misurare il testo in modo preciso (sincrono)
    // IMPORTANTE: Usa gli stessi parametri che userà il ghost container
    const measureTextWidth = (text: string, fontWeight: number = 400): number => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return text.length * 8;

      // ✅ Usa font di sistema standard (stesso che userà il ghost)
      // Il font reale verrà applicato dal CSS, ma questa è una buona approssimazione
      context.font = `${fontWeight} 14px system-ui, -apple-system, sans-serif`;
      return context.measureText(text || '').width;
    };

    // ✅ Costanti UI IDENTICHE a quelle del ghost container
    const ICON_WIDTH = 20;
    const GAP = 10;
    const CHECKBOX_WIDTH = 14 + 6; // Checkbox (14px) + marginRight (6px)
    const CHEVRON_WIDTH = 10 + 6; // Chevron SVG (10px) + marginLeft (6px)
    const BUTTON_PADDING_H = 10 + 10; // padding: '8px 10px' → left + right
    const SUB_INDENT = 36; // marginLeft per sub-items
    const MAIN_INDENT_AGGREGATED = 18; // marginLeft per main items quando aggregated
    const CONTAINER_PADDING = 14 + 14; // paddingLeft + paddingRight
    const GUTTER = 10;
    const EXTRA_PADDING = 10;

    const t = translationsRef.current;
    let maxWidth = 0;

    // ✅ Calcola per tutti i main items e sub-items (IDENTICO al ghost container)
    mainList.forEach((main) => {
      const label = getNodeLabel(main, t);
      // ✅ NO FALLBACKS: getSubNodes always returns array (can be empty)
      const subs = getSubNodes(main);
      const hasSubs = subs.length > 0;

      // Main item width (stesso calcolo del ghost)
      let mainWidth = ICON_WIDTH + GAP + measureTextWidth(label, 400);
      if (aggregated) mainWidth += CHECKBOX_WIDTH;
      if (hasSubs) mainWidth += CHEVRON_WIDTH;
      mainWidth += BUTTON_PADDING_H;
      if (aggregated) mainWidth += MAIN_INDENT_AGGREGATED;

      if (mainWidth > maxWidth) maxWidth = mainWidth;

      // ✅ Sub items (sempre considerati, anche se collassati - IDENTICO al ghost)
      subs.forEach((sub: any) => {
        const subLabel = getNodeLabel(sub, t);
        const subLabelWidth = measureTextWidth(subLabel, 400);
        let subWidth = SUB_INDENT + ICON_WIDTH + GAP + subLabelWidth;
        subWidth += CHECKBOX_WIDTH;
        subWidth += BUTTON_PADDING_H;

        if (subWidth > maxWidth) maxWidth = subWidth;
      });
    });

    // ✅ Root label se aggregated (IDENTICO al ghost)
    if (aggregated && rootLabel) {
      const rootLabelWidth = measureTextWidth(rootLabel, 700);
      const rootWidth = ICON_WIDTH + GAP + rootLabelWidth + BUTTON_PADDING_H;
      if (rootWidth > maxWidth) maxWidth = rootWidth;
    }

    // ✅ Aggiungi padding del container + gutter + padding extra (IDENTICO al ghost)
    const totalWidth = maxWidth + CONTAINER_PADDING + GUTTER + EXTRA_PADDING;
    const clamped = Math.min(
      Math.max(Math.ceil(totalWidth), SIDEBAR_CONTENT_MIN_WIDTH_PX),
      640
    );

    return clamped;
  }, [mainList, aggregated, rootLabel]);

  const [measuredW, setMeasuredW] = React.useState<number | null>(calculateInitialWidth);
  const [hoverRoot, setHoverRoot] = React.useState<boolean>(false);
  const [hoverMainIdx, setHoverMainIdx] = React.useState<number | null>(null);
  const [hoverSub, setHoverSub] = React.useState<{ mainIdx: number; subIdx: number } | null>(null);
  const [pendingEditNewMain, setPendingEditNewMain] = React.useState(false);
  /** After toolbar "+" under a main row: open inline edit on the new sub row (flat list). */
  const [pendingEditNewSub, setPendingEditNewSub] = React.useState<{ mainIdx: number; subIdx: number } | null>(null);
  /** After toolbar "+" under a nested row: open inline edit on the new node (path-based tree). */
  const [pendingEditNewPath, setPendingEditNewPath] = React.useState<number[] | null>(null);
  const [editingMainIdx, setEditingMainIdx] = React.useState<number | null>(null);
  const [editingSub, setEditingSub] = React.useState<{ mainIdx: number; subIdx: number } | null>(null);
  const [editDraft, setEditDraft] = React.useState<string>('');
  /** Set when inline edit opens from "+" pending flow; used with empty draft for full-width label. */
  const [inlineLabelFillRowKey, setInlineLabelFillRowKey] = React.useState<string | null>(null);
  const [overlay, setOverlay] = React.useState<
    | null
    | { type: 'root' | 'main' | 'sub'; mainIdx?: number; subIdx?: number; top: number; left: number }
    | { type: 'nested'; path: number[]; top: number; left: number }
  >(null);
  const hideTimerRef = React.useRef<number | null>(null);
  const overlayHoverRef = React.useRef<boolean>(false);
  const hoverRootRef = React.useRef<boolean>(false);
  const hoverMainIdxRef = React.useRef<number | null>(null);
  const hoverSubRef = React.useRef<{ mainIdx: number; subIdx: number } | null>(null);
  /** After Enter/Escape commits, blur still fires — skip duplicate rename/delete. */
  const skipLabelBlurCommitRef = React.useRef(false);
  /** Aggregate group title inline edit (separate from main/sub editDraft). */
  const [editingAggregateRow, setEditingAggregateRow] = React.useState(false);
  const [aggregateEditDraft, setAggregateEditDraft] = React.useState('');
  const skipAggregateBlurRef = React.useRef(false);
  const aggregateEditRowKey = 'agg';
  React.useEffect(() => { hoverRootRef.current = hoverRoot; }, [hoverRoot]);
  React.useEffect(() => { hoverMainIdxRef.current = hoverMainIdx; }, [hoverMainIdx]);
  React.useEffect(() => { hoverSubRef.current = hoverSub; }, [hoverSub]);

  React.useEffect(() => {
    if (editingMainIdx === null && editingSub === null && editingPath === null) {
      setInlineLabelFillRowKey(null);
    }
  }, [editingMainIdx, editingSub, editingPath]);

  React.useEffect(() => {
    if (!aggregated) {
      setEditingAggregateRow(false);
    }
  }, [aggregated]);

  /**
   * After toolbar "+" adds a node: set editing state when the store already contains
   * the new node. We depend on taskTreeVersion (mutation signal) and read roots via
   * getMainListFromTaskTreeStore() so we do not wait for mainList props to catch up.
   * Focus stays in SidebarInlineEditInput on the row (useLayoutEffect).
   */
  useLayoutEffect(() => {
    if (!pendingEditNewMain) return;
    const roots = getMainListFromTaskTreeStore();
    if (roots.length === 0) return;
    const idx = roots.length - 1;
    setEditingMainIdx(idx);
    setEditDraft(getNodeLabel(roots[idx], translationsRef.current) ?? '');
    setInlineLabelFillRowKey(sidebarMainEditKey(idx));
    setPendingEditNewMain(false);
  }, [pendingEditNewMain, taskTreeVersion]);

  useLayoutEffect(() => {
    if (!pendingEditNewSub) return;
    const { mainIdx, subIdx } = pendingEditNewSub;
    const roots = getMainListFromTaskTreeStore();
    const main = roots[mainIdx];
    if (!main) {
      setPendingEditNewSub(null);
      return;
    }
    const subs = getSubNodes(main);
    if (subs.length <= subIdx) return;
    setEditingSub({ mainIdx, subIdx });
    setEditDraft(getNodeLabel(subs[subIdx], translationsRef.current) ?? '');
    setInlineLabelFillRowKey(sidebarSubEditKey(mainIdx, subIdx));
    setPendingEditNewSub(null);
  }, [pendingEditNewSub, taskTreeVersion]);

  useLayoutEffect(() => {
    if (!pendingEditNewPath || pendingEditNewPath.length === 0) return;
    const roots = getMainListFromTaskTreeStore();
    const node = getNodeByPath(roots, pendingEditNewPath);
    if (!node) return;
    setEditingPath(pendingEditNewPath);
    setEditDraft(getNodeLabel(node, translationsRef.current) ?? '');
    setInlineLabelFillRowKey(sidebarPathEditKey(pendingEditNewPath));
    setPendingEditNewPath(null);
  }, [pendingEditNewPath, taskTreeVersion]);

  const maybeHideOverlay = (delay: number = 320) => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      const stillHoveringItem = !!hoverRootRef.current || (hoverMainIdxRef.current !== null) || !!hoverSubRef.current;
      if (!overlayHoverRef.current && !stillHoveringItem) setOverlay(null);
    }, delay);
  };
  /**
   * Pixel width from style only when explicitly set (e.g. 280 or "280px").
   * Must ignore "100%" — parseFloat("100%") === 100 and was shrinking the sidebar to 100px
   * while the grid column stayed ~280px (button overlapped the splitter).
   */
  const manualWidth = React.useMemo(() => {
    if (style?.width == null) return null;
    const raw = style.width;
    if (typeof raw === 'number') {
      return Number.isFinite(raw) && raw > 0 ? raw : null;
    }
    const s = String(raw).trim();
    if (s.includes('%')) return null;
    const w = parseFloat(s);
    return Number.isFinite(w) && w > 0 ? w : null;
  }, [style?.width]);

  // Updates measuredW when mainList content or labels change.
  // Uses the same canvas measurement as calculateInitialWidth — no ghost React root needed.
  // Regular useEffect (passive, after paint) avoids the nested-commit loop that
  // useLayoutEffect + ReactDOM.createRoot caused.
  React.useEffect(() => {
    if (manualWidth !== null && manualWidth > 0) return;
    setMeasuredW((prev) => (prev === calculateInitialWidth ? prev : calculateInitialWidth));
  }, [calculateInitialWidth, manualWidth]);

  // ✅ DEBUG: Log quando finalWidth cambia
  // ✅ IMPORTANTE: Se measuredW è null, usa un fallback invece di 'auto' per evitare sidebar troppo larga
  const finalWidth = manualWidth ?? measuredW ?? SIDEBAR_CONTENT_MIN_WIDTH_PX;
  const hasFlex = !manualWidth && measuredW === null; // ✅ CRITICO: Solo flex se non c'è manualWidth E measuredW è null

  // ✅ Empty mainList: still render sidebar so manual mode can show "Add root data" (otherwise users see no way to start).
  if (!Array.isArray(mainList)) {
    return null;
  }

  // ✅ Calcola se mostrare i pulsanti Sì/No (stessa logica del Sidebar nuovo)
  const shouldShowStructureButtons = showStructureConfirmation && !structureConfirmed && mainList.length > 0;

  return (
    <div
      ref={assignContainerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={combinedClass}
      style={{
        width: typeof finalWidth === 'number' ? `${finalWidth}px` : finalWidth, // ✅ Assicura che sia una stringa con px
        background: '#121621',
        padding: '16px 14px',
        display: 'flex',
        flexDirection: 'column',
        // ✅ CRITICO: Rimuovi flex: 1 quando c'è width calcolata, altrimenti il width fisso viene ignorato
        ...(hasFlex ? { flex: 1 } : {}),
        minHeight: 0,
        gap: 8,
        outline: 'none',
        position: 'relative',
        flexShrink: 0,
        // ✅ IMPORTANTE: Spread style prop DOPO, ma escludi width per evitare sovrascritture
        ...(style ? Object.fromEntries(Object.entries(style).filter(([key]) => key !== 'width')) : {})
      }}
    >
      {/* ✅ NEW: Pulsanti Sì/No per conferma struttura (in alto, prima dell'albero) */}
      {shouldShowStructureButtons && (
        <div style={{
          marginBottom: '16px',
          paddingBottom: '16px',
          borderBottom: `1px solid ${borderColor}`,
          // ✅ DEBUG: Bordo colorato per i pulsanti Sì/No
          border: '3px solid #22c55e',
          backgroundColor: '#dcfce7',
          padding: '12px',
          borderRadius: '8px',
        }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            color: textBase,
            marginBottom: '12px',
            textAlign: 'center'
          }}>
            Va bene questa struttura dati?
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onStructureConfirm}
              style={{
                flex: 1,
                background: 'linear-gradient(to right, #3b82f6, #2563eb)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
                border: 'none',
                transition: 'all 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(to right, #2563eb, #1d4ed8)';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(to right, #3b82f6, #2563eb)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
              }}
            >
              Sì
            </button>

            <button
              onClick={onStructureReject}
              style={{
                flex: 1,
                background: bgBase,
                color: textBase,
                padding: '8px 12px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
                border: `1px solid ${borderColor}`,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = bgGroup;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = bgBase;
              }}
            >
              No
            </button>
          </div>
        </div>
      )}

      {onAddMain && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            title="Add top-level data field"
            onClick={() => {
              onAddMain('');
              setPendingEditNewMain(true);
            }}
            style={{
              flex: 1,
              minWidth: 120,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 8,
              border: `1px solid ${borderColor}`,
              background: bgBase,
              color: textBase,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <Plus size={14} />
            Add root data
          </button>
        </div>
      )}

      {aggregated && (
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 6,
            width: '100%',
            marginBottom: 6,
            boxSizing: 'border-box',
          }}
        >
          {editingAggregateRow ? (
            <div
              style={{ ...itemStyle(safeSelectedSubIndex === undefined, false), flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}
              className={`sb-item ${safeSelectedSubIndex === undefined ? styles.sidebarSelected : ''}`}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>{getIconComponent('Package')}</span>
              <SidebarInlineEditInput
                active={editingAggregateRow}
                widthMode={sidebarLabelWidthMode(aggregateEditRowKey, aggregateEditRowKey, aggregateEditDraft)}
                value={aggregateEditDraft}
                onChange={(e) => setAggregateEditDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    skipAggregateBlurRef.current = true;
                    onRenameAggregateLabel?.(aggregateEditDraft.trim());
                    setEditingAggregateRow(false);
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    skipAggregateBlurRef.current = true;
                    setAggregateEditDraft(rootLabel || 'Data');
                    setEditingAggregateRow(false);
                  }
                }}
                onBlur={() => {
                  if (skipAggregateBlurRef.current) {
                    skipAggregateBlurRef.current = false;
                    return;
                  }
                  onRenameAggregateLabel?.(aggregateEditDraft.trim());
                  setEditingAggregateRow(false);
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => { (onSelectAggregator ? onSelectAggregator() : undefined); (e.currentTarget as HTMLButtonElement).blur(); ref && typeof ref !== 'function' && ref.current && ref.current.focus && ref.current.focus(); }}
              style={{ ...itemStyle(safeSelectedSubIndex === undefined, false), flex: 1, minWidth: 0 }}
              className={`sb-item ${safeSelectedSubIndex === undefined ? styles.sidebarSelected : ''}`}
              onMouseEnter={(ev) => {
                setHoverRoot(true);
                const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
                setOverlay({ type: 'root', left: rect.right + 6, top: rect.top + rect.height / 2 });
              }}
              onMouseLeave={() => {
                setHoverRoot(false);
                maybeHideOverlay(320);
              }}
            >
              <span style={{ marginRight: 6 }}>{getIconComponent('Package')}</span>
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap', flex: 1, minWidth: 0, textAlign: 'left' }}>{rootLabel || 'Data'}</span>
            </button>
          )}
          {onRenameAggregateLabel && !editingAggregateRow && (
            <button
              type="button"
              title="Rename group"
              onClick={(e) => {
                e.stopPropagation();
                setAggregateEditDraft(rootLabel || 'Data');
                setEditingAggregateRow(true);
              }}
              style={{
                flex: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 10px',
                borderRadius: 10,
                border: `1px solid ${borderColor}`,
                background: bgBase,
                color: textBase,
                cursor: 'pointer',
                alignSelf: 'stretch',
              }}
            >
              <Pencil size={14} color="#e5e7eb" />
            </button>
          )}
          {onAddMain && (
            <button
              type="button"
              title="Add top-level data field"
              onClick={(e) => {
                e.stopPropagation();
                onAddMain('');
                setPendingEditNewMain(true);
              }}
              style={{
                flex: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 10px',
                borderRadius: 10,
                border: `1px solid ${borderColor}`,
                background: bgBase,
                color: textBase,
                cursor: 'pointer',
                alignSelf: 'stretch',
              }}
            >
              <Plus size={14} color="#e5e7eb" />
            </button>
          )}
        </div>
      )}
      {mainList.map((main, idx) => {
        const activeMain = isMainRowActive(idx);
        const disabledMain = !isMainIncluded(idx);
        // ✅ NO FALLBACKS: getSubNodes always returns array (can be empty)
        const subs = getSubNodes(main);
        const defaultMainIcon =
          aggregated && subs.length > 0 ? 'Package' : 'FileText';
        const Icon = getIconComponent(main?.icon || defaultMainIcon);
        return (
          <div key={idx}>
            {mainDrop && mainDrop.targetIndex === idx && mainDrop.placement === 'before' && (
              <div
                style={{
                  height: 2,
                  marginBottom: -4,
                  borderRadius: 1,
                  background: '#3b82f6',
                  boxShadow: '0 0 6px rgba(59,130,246,0.6)',
                }}
              />
            )}
            <button
              draggable={Boolean(onReorderMain)}
              onDragStart={(e) => {
                mainDragRef.current = { fromIdx: idx };
                try { e.dataTransfer?.setData('text/plain', `main:${idx}`); e.dataTransfer.dropEffect = 'move'; e.dataTransfer.effectAllowed = 'move'; } catch { }
              }}
              onDragEnter={(e) => {
                if (mainDragRef.current.fromIdx !== null) e.preventDefault();
              }}
              onDragOver={(e) => {
                if (mainDragRef.current.fromIdx !== null) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  const el = e.currentTarget as HTMLElement;
                  setMainDrop({ targetIndex: idx, placement: dropPlacementFromEvent(e, el) });
                }
              }}
              onDragLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                if (!el.contains(e.relatedTarget as Node)) {
                  setMainDrop(null);
                }
              }}
              onDrop={(e) => {
                const st = mainDragRef.current;
                if (st.fromIdx !== null && typeof onReorderMain === 'function' && st.fromIdx !== idx) {
                  onReorderMain(st.fromIdx, idx);
                }
                mainDragRef.current = { fromIdx: null };
                setMainDrop(null);
                try { e.preventDefault(); } catch { }
              }}
              onDragEnd={() => {
                mainDragRef.current = { fromIdx: null };
                setMainDrop(null);
              }}
              onClick={(e) => {
                if (useNestedTree && subs.length > 0 && !isMainExpanded(idx)) {
                  setExpandedPathKeys((prev) => {
                    const next = new Set(prev);
                    next.add(pathKey([idx]));
                    return next;
                  });
                }
                if (onSelectPath) {
                  onSelectPath([idx]);
                } else {
                  onSelectMain(idx);
                  onSelectSub && onSelectSub(undefined);
                }
                (e.currentTarget as HTMLButtonElement).blur();
                ref && typeof ref !== 'function' && ref.current && ref.current.focus && ref.current.focus();
              }}
              style={{ ...itemStyle(activeMain, false, disabledMain), ...(aggregated ? { marginLeft: 18 } : {}), ...(onReorderMain ? { cursor: 'grab' as const } : {}) }}
              className={`sb-item ${activeMain ? styles.sidebarSelected : ''}`}
              onMouseEnter={(ev) => {
                setHoverMainIdx(idx);
                const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
                setOverlay({ type: 'main', mainIdx: idx, left: rect.right + 6, top: rect.top + rect.height / 2 });
              }}
              onMouseLeave={() => {
                setHoverMainIdx(curr => (curr === idx ? null : curr));
                maybeHideOverlay(320);
              }}
            >
              {aggregated && (
                <span
                  role="checkbox"
                  aria-checked={isMainIncluded(idx)}
                  title="Include main data"
                  onClick={(e) => { e.stopPropagation(); toggleMainInclude(idx, !isMainIncluded(idx)); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMainInclude(idx, !isMainIncluded(idx)); } }}
                  style={{ display: 'inline-flex', alignItems: 'center', marginRight: 6, cursor: 'pointer' }}
                  tabIndex={0}
                >
                  {isMainIncluded(idx) ? (
                    <Check size={14} color="#e5e7eb" />
                  ) : (
                    <span style={{ width: 14, height: 14, display: 'inline-block', border: '1px solid #9ca3af', borderRadius: 3 }} />
                  )}
                </span>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>{Icon}</span>
              {editingMainIdx === idx ? (
                <SidebarInlineEditInput
                  active={editingMainIdx === idx}
                  widthMode={sidebarLabelWidthMode(inlineLabelFillRowKey, sidebarMainEditKey(idx), editDraft)}
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault(); // ✅ CRITICAL: Prevent default to avoid form submission
                      e.stopPropagation(); // ✅ CRITICAL: Stop propagation to prevent button click
                      skipLabelBlurCommitRef.current = true;
                      const t = (editDraft || '').trim();
                      if (!t) {
                        onDeleteMain && onDeleteMain(idx);
                      } else {
                        onRenameMain && onRenameMain(idx, t);
                      }
                      setEditingMainIdx(null);
                      setEditDraft('');
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      skipLabelBlurCommitRef.current = true;
                      const t = (editDraft || '').trim();
                      if (!t) {
                        onDeleteMain && onDeleteMain(idx);
                      }
                      setEditingMainIdx(null);
                      setEditDraft('');
                    }
                  }}
                  onBlur={() => {
                    if (skipLabelBlurCommitRef.current) {
                      skipLabelBlurCommitRef.current = false;
                      return;
                    }
                    const t = (editDraft || '').trim();
                    if (!t) {
                      onDeleteMain && onDeleteMain(idx);
                    } else {
                      onRenameMain && onRenameMain(idx, t);
                    }
                    setEditingMainIdx(null);
                    setEditDraft('');
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={SIDEBAR_ROW_LABEL_INPUT_STYLE}
                />
              ) : (
                <span style={{ whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{getNodeLabel(main, translations)}</span>
              )}
              {(subs.length > 0) && (
                <span
                  role="button"
                  tabIndex={0}
                  title={isMainExpanded(idx) ? 'Collapse' : 'Expand'}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (useNestedTree) {
                      if (isMainExpanded(idx)) {
                        togglePathExpanded([idx]);
                      } else {
                        togglePathExpanded([idx]);
                        if (onSelectPath) onSelectPath([idx]);
                        else {
                          onSelectMain(idx);
                          onSelectSub && onSelectSub(undefined);
                        }
                      }
                    } else if (expandedMainIndex === idx) {
                      setExpandedMainIndex(null);
                    } else {
                      setExpandedMainIndex(idx);
                      onSelectMain(idx);
                      onSelectSub && onSelectSub(undefined);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      if (useNestedTree) {
                        togglePathExpanded([idx]);
                        if (!isMainExpanded(idx) && onSelectPath) onSelectPath([idx]);
                        else if (!isMainExpanded(idx)) {
                          onSelectMain(idx);
                          onSelectSub && onSelectSub(undefined);
                        }
                      } else if (expandedMainIndex === idx) {
                        setExpandedMainIndex(null);
                      } else {
                        setExpandedMainIndex(idx);
                        onSelectMain(idx);
                        onSelectSub && onSelectSub(undefined);
                      }
                    }
                  }}
                  style={{ marginLeft: 6, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 0, display: 'inline-flex' }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: `rotate(${isMainExpanded(idx) ? 90 : 0}deg)`, transition: 'transform 0.15s' }} aria-hidden>
                    <polyline points="2,1 8,5 2,9" fill="none" stroke={borderColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
              {/* ✅ Parser icon inline in button (right side) */}
              <ParserStatusRow
                node={main}
                inline={true}
                onCreateClick={() => {
                  // After validation strict, main.id is always present
                  const nodeId = getNodeIdStrict(main);
                  onParserCreate?.(nodeId, main);
                }}
                onModifyClick={() => {
                  // After validation strict, main.id is always present
                  const nodeId = getNodeIdStrict(main);
                  onParserModify?.(nodeId, main);
                }}
                onEngineChipClick={(engineType) => {
                  // After validation strict, main.id is always present
                  const nodeId = getNodeIdStrict(main);
                  // Map EngineType to editor type
                  const editorTypeMap: Record<EngineType, 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings'> = {
                    regex: 'regex',
                    rule_based: 'extractor',
                    ner: 'ner',
                    llm: 'llm',
                    embedding: 'embeddings',
                  };
                  const editorType = editorTypeMap[engineType] || 'regex';
                  onEngineChipClick?.(nodeId, main, editorType);
                }}
              />
            </button>
            {mainDrop && mainDrop.targetIndex === idx && mainDrop.placement === 'after' && (
              <div
                style={{
                  height: 2,
                  marginTop: -4,
                  marginBottom: 2,
                  borderRadius: 1,
                  background: '#3b82f6',
                  boxShadow: '0 0 6px rgba(59,130,246,0.6)',
                }}
              />
            )}
            {(isMainExpanded(idx) && subs.length > 0) && useNestedTree && onReorderAtPath && onRenameAtPath && onDeleteAtPath && onChangeRequiredAtPath && (
              <SidebarNestedList
                nodes={subs}
                siblingParentPath={[idx]}
                depth={1}
                translations={translations}
                selectedPathProp={selectedPathProp}
                onSelectPath={onSelectPath}
                expandedKeys={expandedPathKeys}
                toggleExpanded={togglePathExpanded}
                onReorderAtPath={onReorderAtPath}
                onRenameAtPath={onRenameAtPath}
                onDeleteAtPath={onDeleteAtPath}
                onChangeRequiredAtPath={onChangeRequiredAtPath}
                nestedDragRef={nestedDragRef}
                nestedDrop={nestedDrop}
                setNestedDrop={setNestedDrop}
                itemStyle={itemStyle}
                borderColor={borderColor}
                bgGroup={bgGroup}
                sidebarSelectedClass={styles.sidebarSelected}
                indentStep={36}
                baseMarginLeft={36}
                editingPath={editingPath}
                editDraft={editDraft}
                fillLabelPathKey={inlineLabelFillRowKey}
                setEditingPath={setEditingPath}
                setEditDraft={setEditDraft}
                setOverlay={(o) => setOverlay(o)}
                maybeHideOverlay={maybeHideOverlay}
                hoverPathRef={hoverPathRefNested}
                onParserCreate={onParserCreate}
                onParserModify={onParserModify}
                onEngineChipClick={onEngineChipClick}
              />
            )}
            {(isMainExpanded(idx) && subs.length > 0) && !useNestedTree && (
              <div style={{ marginLeft: 36, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {subs.map((sub: any, sidx: number) => {
                  const reqEffective = sub?.required !== false;
                  const activeSub = isSubRowActive(idx, sidx);
                  // Grayscale when main is unchecked OR when this sub is unchecked (required=false)
                  const disabledSub = (!isMainIncluded(idx)) || (!reqEffective);
                  const SubIcon = getIconComponent(sub?.icon || 'FileText');
                  return (
                    <React.Fragment key={sidx}>
                      <button
                        draggable
                        onDragStart={(e) => {
                          dragStateRef.current = { mainIdx: idx, fromIdx: sidx };
                          try { e.dataTransfer?.setData('text/plain', String(sidx)); e.dataTransfer.dropEffect = 'move'; e.dataTransfer.effectAllowed = 'move'; } catch { }
                          try { if (localStorage.getItem('debug.sidebar') === '1') console.log('[DDT][sub.dragStart]', { main: getNodeLabel(main, translations), from: sidx }); } catch { }
                        }}
                        onDragEnter={(e) => {
                          // same-main only
                          if (dragStateRef.current.mainIdx === idx) {
                            e.preventDefault();
                          }
                        }}
                        onDragOver={(e) => {
                          if (dragStateRef.current.mainIdx === idx) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }
                        }}
                        onDrop={(e) => {
                          const st = dragStateRef.current;
                          if (st.mainIdx === idx && st.fromIdx !== null && typeof onReorderSub === 'function') {
                            if (st.fromIdx !== sidx) {
                              onReorderSub(idx, st.fromIdx, sidx);
                              try { if (localStorage.getItem('debug.sidebar') === '1') console.log('[DDT][sub.drop]', { main: getNodeLabel(main, translations), from: st.fromIdx, to: sidx }); } catch { }
                            }
                          }
                          dragStateRef.current = { mainIdx: null, fromIdx: null };
                          try { e.preventDefault(); } catch { }
                        }}
                        onDragEnd={() => { dragStateRef.current = { mainIdx: null, fromIdx: null }; }}
                        onClick={(e) => {
                          e.stopPropagation(); // ✅ Prevent event bubbling
                          if (onSelectPath) {
                            onSelectPath([idx, sidx]);
                          } else {
                            onSelectSub && onSelectSub(sidx, idx);
                          }
                          (e.currentTarget as HTMLButtonElement).blur();
                          ref && typeof ref !== 'function' && ref.current && ref.current.focus && ref.current.focus();
                        }}
                        onMouseEnter={(ev) => {
                          setHoverSub({ mainIdx: idx, subIdx: sidx });
                          const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
                          setOverlay({ type: 'sub', mainIdx: idx, subIdx: sidx, left: rect.right + 6, top: rect.top + rect.height / 2 });
                        }}
                        onMouseLeave={() => {
                          setHoverSub(curr => (curr && curr.mainIdx === idx && curr.subIdx === sidx ? null : curr));
                          maybeHideOverlay(320);
                        }}
                        style={{ ...itemStyle(activeSub, true, disabledSub), ...(activeSub ? {} : { background: bgGroup }), cursor: 'grab' }}
                        className={`sb-item ${activeSub ? styles.sidebarSelected : ''}`}
                      >
                        <span
                          role="checkbox"
                          aria-checked={reqEffective}
                          title={reqEffective ? 'Required' : 'Optional'}
                          onClick={(e) => { e.stopPropagation(); const next = !reqEffective; onChangeSubRequired && onChangeSubRequired(idx, sidx, next); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const next = !reqEffective; onChangeSubRequired && onChangeSubRequired(idx, sidx, next); } }}
                          style={{ display: 'inline-flex', alignItems: 'center', marginRight: 6, cursor: 'pointer' }}
                          tabIndex={0}
                        >
                          {reqEffective ? (
                            <Check size={14} color="#e5e7eb" />
                          ) : (
                            <span style={{ width: 14, height: 14, display: 'inline-block', border: '1px solid #9ca3af', borderRadius: 3 }} />
                          )}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center' }}>{SubIcon}</span>
                        {editingSub && editingSub.mainIdx === idx && editingSub.subIdx === sidx ? (
                          <SidebarInlineEditInput
                            active
                            widthMode={sidebarLabelWidthMode(
                              inlineLabelFillRowKey,
                              sidebarSubEditKey(idx, sidx),
                              editDraft
                            )}
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault(); // ✅ CRITICAL: Prevent default to avoid form submission
                                e.stopPropagation(); // ✅ CRITICAL: Stop propagation to prevent button click
                                skipLabelBlurCommitRef.current = true;
                                const t = (editDraft || '').trim();
                                if (!t) {
                                  onDeleteSub && onDeleteSub(editingSub.mainIdx, editingSub.subIdx);
                                } else {
                                  onRenameSub && onRenameSub(editingSub.mainIdx, editingSub.subIdx, t);
                                }
                                setEditingSub(null);
                                setEditDraft('');
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                e.stopPropagation();
                                skipLabelBlurCommitRef.current = true;
                                const t = (editDraft || '').trim();
                                if (!t) {
                                  onDeleteSub && onDeleteSub(editingSub.mainIdx, editingSub.subIdx);
                                }
                                setEditingSub(null);
                                setEditDraft('');
                              }
                            }}
                            onBlur={() => {
                              if (skipLabelBlurCommitRef.current) {
                                skipLabelBlurCommitRef.current = false;
                                return;
                              }
                              const t = (editDraft || '').trim();
                              if (!t) {
                                onDeleteSub && onDeleteSub(editingSub.mainIdx, editingSub.subIdx);
                              } else {
                                onRenameSub && onRenameSub(editingSub.mainIdx, editingSub.subIdx, t);
                              }
                              setEditingSub(null);
                              setEditDraft('');
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={SIDEBAR_ROW_LABEL_INPUT_STYLE}
                          />
                        ) : (
                          <span style={{ whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{getNodeLabel(sub, translations)}</span>
                        )}
                        {/* ✅ Parser icon inline in button (right side) */}
                        <ParserStatusRow
                          node={sub}
                          inline={true}
                          onCreateClick={() => {
                            // After validation strict, sub.id is always present
                            const nodeId = getNodeIdStrict(sub);
                            onParserCreate?.(nodeId, sub);
                          }}
                          onModifyClick={() => {
                            // After validation strict, sub.id is always present
                            const nodeId = getNodeIdStrict(sub);
                            onParserModify?.(nodeId, sub);
                          }}
                          onEngineChipClick={(engineType) => {
                            // After validation strict, sub.id is always present
                            const nodeId = getNodeIdStrict(sub);
                            // Map EngineType to editor type
                            const editorTypeMap: Record<EngineType, 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings'> = {
                              regex: 'regex',
                              rule_based: 'extractor',
                              ner: 'ner',
                              llm: 'llm',
                              embedding: 'embeddings',
                            };
                            const editorType = editorTypeMap[engineType] || 'regex';
                            onEngineChipClick?.(nodeId, sub, editorType);
                          }}
                        />
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {/* ✅ Floating overlay - always visible when hovering over sidebar items */}
      {/* ✅ Sidebar is always editable, even when wizard is active */}
      {overlay && createPortal(
        <div
          onMouseEnter={() => { overlayHoverRef.current = true; if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current); }}
          onMouseLeave={() => { overlayHoverRef.current = false; maybeHideOverlay(200); }}
          style={{ position: 'fixed', top: overlay.top, left: overlay.left, transform: 'translateY(-50%)', zIndex: 9999, background: 'transparent', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {overlay.type === 'main' && (
            <>
              <button
                type="button"
                title="Add nested field under this row"
                style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                onClick={() => {
                  if (typeof overlay.mainIdx !== 'number' || !onAddChildAtPath) return;
                  const mainIdx = overlay.mainIdx;
                  const newSubIdx = getSubNodes(mainList[mainIdx]).length;
                  if (useNestedTree) {
                    setExpandedPathKeys((prev) => {
                      const next = new Set(prev);
                      next.add(pathKey([mainIdx]));
                      return next;
                    });
                    onAddChildAtPath([mainIdx], '');
                    /** Nested rows use editingPath, not editingSub (flat list only). */
                    setPendingEditNewPath([mainIdx, newSubIdx]);
                  } else {
                    setExpandedMainIndex(mainIdx);
                    onAddChildAtPath([mainIdx], '');
                    setPendingEditNewSub({ mainIdx, subIdx: newSubIdx });
                  }
                  setOverlay(null);
                }}
              >
                <Plus size={14} color="#e5e7eb" />
              </button>
              <button title="Rename" style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => { if (typeof overlay.mainIdx === 'number') { setInlineLabelFillRowKey(null); setEditingMainIdx(overlay.mainIdx); setEditDraft(getNodeLabel(mainList[overlay.mainIdx], translations)); setOverlay(null); } }}>
                <Pencil size={14} color="#e5e7eb" />
              </button>
              <button title="Delete" style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => { if (typeof overlay.mainIdx === 'number' && onDeleteMain) { onDeleteMain(overlay.mainIdx); setOverlay(null); } }}>
                <Trash2 size={14} color="#e5e7eb" />
              </button>
            </>
          )}
          {overlay.type === 'sub' && (
            <>
              <button
                type="button"
                title="Add nested field under this row"
                style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                onClick={() => {
                  if (
                    typeof overlay.mainIdx !== 'number' ||
                    typeof overlay.subIdx !== 'number' ||
                    !onAddChildAtPath
                  ) {
                    return;
                  }
                  const m = overlay.mainIdx;
                  const s = overlay.subIdx;
                  const parentRow = getSubNodes(mainList[m])[s];
                  const newIdx = getSubNodes(parentRow).length;
                  if (useNestedTree) {
                    setExpandedPathKeys((prev) => {
                      const next = new Set(prev);
                      next.add(pathKey([m]));
                      next.add(pathKey([m, s]));
                      return next;
                    });
                    onAddChildAtPath([m, s], '');
                    setPendingEditNewPath([m, s, newIdx]);
                  } else {
                    onAddChildAtPath([m, s], '');
                  }
                  setOverlay(null);
                }}
              >
                <Plus size={12} color="#e5e7eb" />
              </button>
              <button title="Rename sub" style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => { if (typeof overlay.mainIdx === 'number' && typeof overlay.subIdx === 'number') { setInlineLabelFillRowKey(null); setEditingSub({ mainIdx: overlay.mainIdx, subIdx: overlay.subIdx }); const sub = getSubNodes(mainList[overlay.mainIdx])[overlay.subIdx]; setEditDraft(getNodeLabel(sub, translations)); setOverlay(null); } }}>
                <Pencil size={12} color="#e5e7eb" />
              </button>
              <button title="Delete sub" style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => { if (typeof overlay.mainIdx === 'number' && typeof overlay.subIdx === 'number' && onDeleteSub) { onDeleteSub(overlay.mainIdx, overlay.subIdx); setOverlay(null); } }}>
                <Trash2 size={12} color="#e5e7eb" />
              </button>
            </>
          )}
          {overlay.type === 'nested' && onRenameAtPath && onDeleteAtPath && (
            <>
              {onAddChildAtPath && (
                <button
                  type="button"
                  title="Add nested field under this row"
                  style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                  onClick={() => {
                    const parentPath = overlay.path;
                    const parent = getNodeByPath(mainList, parentPath);
                    const newIdx = parent ? getSubNodes(parent).length : 0;
                    setExpandedPathKeys((prev) => {
                      const next = new Set(prev);
                      for (let len = 1; len <= parentPath.length; len++) {
                        next.add(pathKey(parentPath.slice(0, len)));
                      }
                      return next;
                    });
                    onAddChildAtPath(parentPath, '');
                    setPendingEditNewPath([...parentPath, newIdx]);
                    setOverlay(null);
                  }}
                >
                  <Plus size={12} color="#e5e7eb" />
                </button>
              )}
              <button
                title="Rename"
                style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                onClick={() => {
                  const node = getNodeByPath(mainList, overlay.path);
                  if (node) {
                    setInlineLabelFillRowKey(null);
                    setEditingPath(overlay.path);
                    setEditDraft(getNodeLabel(node, translations));
                  }
                  setOverlay(null);
                }}
              >
                <Pencil size={12} color="#e5e7eb" />
              </button>
              <button
                title="Delete"
                style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
                onClick={() => {
                  onDeleteAtPath(overlay.path);
                  setOverlay(null);
                }}
              >
                <Trash2 size={12} color="#e5e7eb" />
              </button>
            </>
          )}
        </div>, document.body)}
    </div>
  );
}

const Sidebar = forwardRef<HTMLDivElement, SidebarProps>(SidebarComponent);
export default Sidebar;

