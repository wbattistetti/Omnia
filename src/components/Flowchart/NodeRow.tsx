import React, { useState, useEffect, useRef } from 'react';
import { useProjectData } from '../../context/ProjectDataContext';
import { useDDTManager } from '../../context/DDTManagerContext';
import { ProjectDataService } from '../../services/ProjectDataService';
import { EntityCreationService } from '../../services/EntityCreationService';
import { createAndAttachAct } from '../../services/ActFactory';
import { useActEditor } from '../ActEditor/EditorHost/ActEditorContext';
import { emitSidebarRefresh } from '../../ui/events';
import { createPortal } from 'react-dom';
import { useReactFlow } from 'reactflow';
import { Ear, CheckCircle2, Megaphone, GitBranch, FileText, Server, Check } from 'lucide-react';
import { SIDEBAR_TYPE_ICONS, getSidebarIconComponent } from '../Sidebar/sidebarTheme';
import { IntellisenseItem } from '../Intellisense/IntellisenseTypes';
import { getLabelColor } from '../../utils/labelColor';
import { useOverlayBuffer } from '../../hooks/useOverlayBuffer';
import { NodeRowEditor } from './NodeRowEditor';
import { NodeRowProps } from '../../types/NodeRowTypes';
import { SIDEBAR_TYPE_COLORS } from '../Sidebar/sidebarTheme';
import { NodeRowLabel } from './NodeRowLabel';
import { NodeRowIntellisense } from './NodeRowIntellisense';
import { useRowToolbar } from './hooks/useRowToolbar';
import { getAgentActVisualsByType, findAgentAct, resolveActMode, resolveActType, hasActDDT } from './actVisuals';
import { inferActType, heuristicToInternal } from '../../nlp/actType';
import { modeToType, typeToMode } from '../../utils/normalizers';
// Keyboard navigable type picker toolbar
const TYPE_OPTIONS = [
  { key: 'Message', label: 'Message', Icon: Megaphone, color: '#34d399' },
  { key: 'DataRequest', label: 'Data', Icon: Ear, color: '#3b82f6' },
  { key: 'Confirmation', label: 'Confirmation', Icon: CheckCircle2, color: '#6366f1' },
  { key: 'ProblemClassification', label: 'Problem', Icon: GitBranch, color: '#f59e0b' },
  { key: 'Summarizer', label: 'Summarizer', Icon: FileText, color: '#06b6d4' },
  { key: 'BackendCall', label: 'BackendCall', Icon: Server, color: '#94a3b8' }
];

function TypePickerToolbar({ left, top, onPick, rootRef, currentType, onRequestClose }: { left: number; top: number; onPick: (k: string) => void; rootRef?: React.RefObject<HTMLDivElement>; currentType?: string; onRequestClose?: () => void }) {
  const [focusIdx, setFocusIdx] = React.useState(0);
  const btnRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  React.useEffect(() => {
    setFocusIdx(0);
    setTimeout(() => btnRefs.current[0]?.focus(), 0);
    return () => {};
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const key = e.key;
    const lower = (key || '').toLowerCase();
    const block = ['ArrowDown','ArrowUp','Enter','Escape'];
    if (block.includes(key)) { e.preventDefault(); e.stopPropagation(); }
    if (lower.length === 1 && /[a-z]/.test(lower)) {
      const map: Record<string, string> = { m:'Message', d:'DataRequest', c:'Confirmation', p:'ProblemClassification', s:'Summarizer', b:'BackendCall' };
      const match = map[lower];
      if (match && match !== currentType) { onPick(match); return; }
    }
    if (key === 'ArrowDown') setFocusIdx(i => Math.min(TYPE_OPTIONS.length - 1, i + 1));
    else if (key === 'ArrowUp') setFocusIdx(i => Math.max(0, i - 1));
    else if (key === 'Enter') { const opt = TYPE_OPTIONS[focusIdx]; if (opt && opt.key !== currentType) onPick(opt.key); }
  };

  return (
    <div
      style={{
        position: 'fixed', left, top,
        padding: 6,
        background: 'rgba(17,24,39,0.92)',
        border: '1px solid rgba(234,179,8,0.35)',
        boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
        width: 'max-content', maxWidth: 220,
        borderRadius: 12,
        backdropFilter: 'blur(3px) saturate(120%)',
        WebkitBackdropFilter: 'blur(3px) saturate(120%)'
      }}
      role="menu"
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="Pick act type"
      ref={rootRef as any}
      onPointerDown={(e) => { e.stopPropagation(); }}
      onPointerLeave={() => { setTimeout(() => { try { onRequestClose && onRequestClose(); } catch {} }, 100); }}
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
        onMouseEnter={() => { try { console.log('[Picker][enter]'); } catch {} }}
        onMouseLeave={() => {
          try { console.log('[Picker][leave]'); } catch {}
          setTimeout(() => { try { onRequestClose && onRequestClose(); } catch {} }, 100);
        }}
      >
        {TYPE_OPTIONS.map((opt, i) => {
          const isCurrent = currentType === opt.key;
          return (
            <button
              key={opt.key}
              ref={el => (btnRefs.current[i] = el)}
              disabled={isCurrent}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                minWidth: 180,
                padding: '6px 8px',
                border: 'none',
                borderRadius: 8,
                background: isCurrent ? 'rgba(30,41,59,0.7)' : 'rgba(0,0,0,0.75)',
                color: isCurrent ? '#94a3b8' : '#e5e7eb',
                cursor: isCurrent ? 'default' : 'pointer',
                outline: i === focusIdx ? '1px solid rgba(234,179,8,0.45)' : 'none'
              }}
              tabIndex={i === focusIdx ? 0 : -1}
              aria-selected={i === focusIdx}
              onMouseEnter={() => setFocusIdx(i)}
              onFocus={() => setFocusIdx(i)}
              onMouseDown={(e) => { if (isCurrent) return; e.preventDefault(); e.stopPropagation(); onPick(opt.key); }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <opt.Icon className="w-4 h-4" style={{ color: isCurrent ? '#64748b' : opt.color }} />
                <span>{opt.label}</span>
              </span>
              {isCurrent && (
                <Check className="w-4 h-4" style={{ color: '#22c55e' }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
// (moved import of normalizers to top to avoid mid-file import parsing issues)

const NodeRowInner: React.ForwardRefRenderFunction<HTMLDivElement, NodeRowProps> = (
  {
    row,
    nodeTitle,
    nodeCanvasPosition,
    onUpdate,
    onUpdateWithCategory,
    onDelete,
    onKeyDown,
    onDragStart,
    onMoveRow,
    onDropRow,
    index,
    canDelete,
    totalRows,
    isHoveredTarget = false,
    isBeingDragged = false,
    isPlaceholder = false,
    style,
    forceEditing = false,
    onMouseEnter,
    onMouseLeave,
    onMouseMove,
    bgColor: propBgColor,
    textColor: propTextColor,
    onEditingEnd,
    onCreateAgentAct,
    onCreateBackendCall,
    onCreateTask,
    getProjectId
  }: NodeRowProps,
  ref
) => {
  const { data: projectDataCtx } = useProjectData();
  // Debug gate for icon/flow logs (enable with localStorage.setItem('debug.flowIcons','1'))
  const debugFlowIcons = (() => { try { return Boolean(localStorage.getItem('debug.flowIcons')); } catch { return false; } })();
  const [isEditing, setIsEditing] = useState(forceEditing);
  const [hasEverBeenEditing, setHasEverBeenEditing] = useState(forceEditing);
  const [currentText, setCurrentText] = useState(row.text);
  const [included, setIncluded] = useState(row.included !== false); // default true
  const [showIntellisense, setShowIntellisense] = useState(false);
  const [intellisenseQuery, setIntellisenseQuery] = useState('');
  const [allowCreatePicker, setAllowCreatePicker] = useState(false);
  const [showCreatePicker, setShowCreatePicker] = useState(false);
  const typeToolbarRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [nodeOverlayPosition, setNodeOverlayPosition] = useState<{ left: number; top: number } | null>(null);
  const nodeContainerRef = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();
  const getZoom = () => {
    try { return (reactFlowInstance as any)?.getViewport?.().zoom || 1; } catch { return 1; }
  };
  const [showIcons, setShowIcons] = useState(false);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [iconPos, setIconPos] = useState<{top: number, left: number} | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  // State machine for toolbar/picker visibility (after refs are initialized)
  const toolbarSM = useRowToolbar({ rowRef: nodeContainerRef as any, overlayRef: overlayRef as any, pickerRef: typeToolbarRef as any });
  const suppressIntellisenseRef = useRef<boolean>(false);
  const intellisenseTimerRef = useRef<number | null>(null);

  // Track global mouse position to implement a stability buffer between row and toolbar
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => { mousePosRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  function isInsideWithPadding(pt: { x: number; y: number }, rect: DOMRect | null | undefined, pad = 16): boolean {
    if (!rect) return false;
    return pt.x >= rect.left - pad && pt.x <= rect.right + pad && pt.y >= rect.top - pad && pt.y <= rect.bottom + pad;
  }

  // Rough estimation of the overlay toolbar bounds next to the label/icon
  function getToolbarRect(left: number, top: number, labelEl: HTMLElement | null, estWidth = 160): DOMRect | null {
    if (!labelEl) return null;
    const h = labelEl.getBoundingClientRect().height || 18;
    return ({ left, top: top + 3, right: left + estWidth, bottom: top + 3 + h, width: estWidth, height: h } as any);
  }

  // Hide action overlay while editing to avoid ghost bars
  useEffect(() => {
    if (isEditing) setShowIcons(false);
  }, [isEditing]);

  // Compute buffer after deps are defined - passa overlayRef per calcolo preciso
  const bufferRect = useOverlayBuffer(labelRef, iconPos, showIcons, overlayRef);
  // Debug: log overlay area changes safely (guard undefined)
  useEffect(() => {
  }, [bufferRect, showIcons]);

  // ESC: when type toolbar is open, close it and refocus textbox without propagating to canvas
  useEffect(() => {
    if (!showCreatePicker) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch {}
      setShowCreatePicker(false);
      setAllowCreatePicker(false);
      suppressIntellisenseRef.current = true;
      // restore focus to the editor textarea
      try {
        if (inputRef.current) {
          const el = inputRef.current;
          el.focus();
          // place caret at end
          const val = el.value || '';
          el.setSelectionRange(val.length, val.length);
        }
      } catch {}
    };
    document.addEventListener('keydown', onEsc, true);
    return () => document.removeEventListener('keydown', onEsc, true);
  }, [showCreatePicker]);

  // Debug: track picker visibility/position
  useEffect(() => {
  }, [showCreatePicker, nodeOverlayPosition]);

  // reset suppression when editing ends
  useEffect(() => {
    if (!isEditing) suppressIntellisenseRef.current = false;
  }, [isEditing]);
  const { openDDT } = useDDTManager();
  const hoverHideTimerRef = useRef<number | null>(null);

  // Calcola la posizione e dimensione della zona buffer (already computed above)

  // Helper per entrare in editing
  const enterEditing = () => {
    setIsEditing(true);
    // assicurati che la toolbar dei tipi sia sempre chiusa quando inizi a scrivere
    setShowCreatePicker(false);
    setAllowCreatePicker(false);
  };

  // Quando entri in editing, calcola la posizione del nodo
  useEffect(() => {
    if (isEditing) {
      // mentre scrivi, assicurati che il picker resti chiuso
      setShowCreatePicker(false);
      setAllowCreatePicker(false);
      let left = 0;
      let top = 0;
      if (nodeCanvasPosition && inputRef.current) {
        // Ottieni offset locale dell'input rispetto al nodo
        const inputOffset = inputRef.current.getBoundingClientRect();
        const nodeRect = nodeContainerRef.current?.getBoundingClientRect();
        const offsetX = nodeRect && inputOffset ? (inputOffset.left - nodeRect.left) : 0;
        const offsetY = nodeRect && inputOffset ? (inputOffset.top - nodeRect.top) : 0;
        // Ottieni pan/zoom
        const { x: panX, y: panY, zoom } = reactFlowInstance.toObject().viewport;
        // Ottieni bounding rect del container React Flow
        const container = document.querySelector('.react-flow');
        const containerRect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
        // Calcola posizione schermo
        left = containerRect.left + (nodeCanvasPosition.x + offsetX) * zoom + panX;
        top = containerRect.top + (nodeCanvasPosition.y + offsetY) * zoom + panY;
      } else if (nodeContainerRef.current) {
        const rect = nodeContainerRef.current.getBoundingClientRect();
        left = rect.left + window.scrollX;
        top = rect.bottom + window.scrollY;
      }
      setNodeOverlayPosition({ left, top });
    } else if (!isEditing) {
      setNodeOverlayPosition(null);
    }
  }, [isEditing, nodeCanvasPosition, reactFlowInstance]);

  // Recompute overlay position when textarea height changes (wrap).
  useEffect(() => {
    if (!isEditing || !inputRef.current) return;
    const el = inputRef.current;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setNodeOverlayPosition({ left: rect.left, top: rect.bottom + window.scrollY });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [isEditing]);

  // Intercetta tasti globali quando la type toolbar è aperta, per evitare che raggiungano il canvas
  useEffect(() => {
    if (!showCreatePicker) return;
    const onGlobalKeyDown = (ev: KeyboardEvent) => {
      const keys = ['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Enter','Escape'];
      if (keys.includes(ev.key)) {
        const t = ev.target as Node | null;
        if (typeToolbarRef.current && t instanceof Node && typeToolbarRef.current.contains(t)) {
          return; // lascia passare alla toolbar
        }
        ev.preventDefault();
        ev.stopPropagation();
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onGlobalKeyDown, { capture: true } as any);
  }, [showCreatePicker]);

  // Calcola la posizione delle icone: appena FUORI dal bordo destro del nodo, all'altezza della label
  useEffect(() => {
    if (showIcons && labelRef.current) {
      const labelRect = labelRef.current.getBoundingClientRect();
      const nodeEl = labelRef.current.closest('.react-flow__node') as HTMLElement | null;
      const nodeRect = nodeEl ? nodeEl.getBoundingClientRect() : labelRect;
      setIconPos({
        top: labelRect.top,
        left: nodeRect.right + 6 // 6px fuori dal bordo destro del nodo
      });
    } else {
      setIconPos(null);
    }
  }, [showIcons]);

  // Bridge SM → local booleans used by layout effects
  useEffect(() => {
    if (toolbarSM.showIcons !== showIcons) setShowIcons(toolbarSM.showIcons);
    if (toolbarSM.showPicker !== showCreatePicker) setShowCreatePicker(toolbarSM.showPicker);
  }, [toolbarSM.showIcons, toolbarSM.showPicker]);

  useEffect(() => {
    if (forceEditing) setIsEditing(true);
  }, [forceEditing]);

  // Debug disattivato di default (abilitabile via debug.flowIcons)
  useEffect(() => {
    // no-op
  }, [showIcons, row.id, iconPos, debugFlowIcons]);

  useEffect(() => {
    // Traccia se siamo mai entrati in editing
    if (isEditing) {
      setHasEverBeenEditing(true);
    }
  }, [isEditing]);

  useEffect(() => {
    // Solo chiamare onEditingEnd se stiamo uscendo dall'editing (era true, ora false)
    // E se siamo mai entrati in editing
    if (!isEditing && hasEverBeenEditing && typeof onEditingEnd === 'function') {
      onEditingEnd();
    }
  }, [isEditing, hasEverBeenEditing]);

  // Canvas click = ESC semantics: close intellisense if open, otherwise end editing without deleting
  useEffect(() => {
    const handleCanvasClick = () => {
      if (!isEditing) return;
      if (showIntellisense) {
        setShowIntellisense(false);
        setIntellisenseQuery('');
        return;
      }
      // End editing gracefully, keep the row/node even if empty
      setCurrentText(row.text);
      setIsEditing(false);
      setShowIntellisense(false);
      setIntellisenseQuery('');
      if (typeof onEditingEnd === 'function') {
        onEditingEnd();
      }
    };
    window.addEventListener('flow:canvas:click', handleCanvasClick as any, { capture: false } as any);
    return () => window.removeEventListener('flow:canvas:click', handleCanvasClick as any);
  }, [isEditing, showIntellisense, row.text, onEditingEnd]);

  const handleSave = async () => {
    const label = currentText.trim() || row.text;
    onUpdate(row, label);
    try {
      // aggiorna cache locale del testo messaggio
      if (onUpdateWithCategory) {
        (onUpdateWithCategory as any)(row, label, (row as any)?.categoryType, { message: { text: label } });
      }
    } catch {}
    setIsEditing(false);
    setShowIntellisense(false);
    setIntellisenseQuery('');
    // PUT non-bloccante: salva in background
    try {
      let pid: string | undefined = undefined;
      try { pid = ((require('../../state/runtime') as any).getCurrentProjectId?.() || undefined); } catch {}
      if (pid && (row as any)?.instanceId && ((row as any)?.mode === 'Message' || !(row as any)?.mode)) {
        void ProjectDataService.updateInstance(pid, (row as any).instanceId, { message: { text: label } })
          .catch((e) => { try { console.warn('[Row][save][instance:update] failed', e); } catch {} });
      }
    } catch {}
    if (typeof onEditingEnd === 'function') {
      onEditingEnd();
    }
  };

  const handleCancel = () => {
    if (currentText.trim() === '') {
      onDelete(row);
    } else {
      setCurrentText(row.text);
      setIsEditing(false);
      setShowIntellisense(false);
      setIntellisenseQuery('');
      if (typeof onEditingEnd === 'function') {
        onEditingEnd();
      }
    }
  };

  const handleKeyDownInternal = async (e: React.KeyboardEvent) => {
    const dbg = (() => { try { return Boolean(localStorage.getItem('debug.picker')); } catch { return false; } })();

    if (e.key === '/' && !showIntellisense) {
      // Activate intellisense with slash
      setIntellisenseQuery('');
      setShowIntellisense(true);
      setAllowCreatePicker(false);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      if (showIntellisense) {
        setShowIntellisense(false);
        setIntellisenseQuery('');
        setShowCreatePicker(false);
      } else {
        if (onKeyDown) onKeyDown(e); // Propaga ESC al parent
        handleCancel();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const q = (currentText || '').trim();
      // Quick-create Conditions: se questa riga appartiene alle conditions, crea subito senza intellisense
      if ((row as any)?.categoryType === 'conditions') {
        try {
          const created = EntityCreationService.createCondition({
            name: q,
            projectData,
            projectIndustry: (projectData as any)?.industry,
            scope: 'industry'
          });
          if (created) {
            if (onUpdateWithCategory) {
              (onUpdateWithCategory as any)(row, q, 'conditions', { conditionId: created.id });
            } else {
              onUpdate(row, q);
            }
            setIsEditing(false);
            setShowIntellisense(false);
            setIntellisenseQuery('');
            try { emitSidebarRefresh(); } catch {}
          }
        } catch (err) {
          try { console.warn('[CondFlow] quick-create failed', err); } catch {}
        }
        return;
      }

      // Alt+Enter: apri la toolbar manuale dei tipi
      if (e.altKey) {
        if (dbg) {}
        setIntellisenseQuery(q);
        setShowIntellisense(false);
        setAllowCreatePicker(true);
        setShowCreatePicker(true);
        try { inputRef.current?.blur(); } catch {}
        return;
      }
      // Heuristica multilingua: IT/EN/PT con fallback a Message
      try {
        const inf = inferActType(q, { languageOrder: ['IT','EN','PT'] as any });
        const internal = heuristicToInternal(inf.type as any);
        if (dbg) {}
        await handlePickType(internal);
        return;
      } catch (err) {
        try { console.warn('[Heuristics] failed, fallback to picker', err); } catch {}
        setIntellisenseQuery(q);
        setShowIntellisense(false);
        setAllowCreatePicker(true);
        setShowCreatePicker(true);
        try { inputRef.current?.blur(); } catch {}
        return;
      }
    }
  };

  // Handle text change and trigger intellisense
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setCurrentText(newText);
    // Mostra intellisense mentre scrivi; non mostrare il picker finché non premi Enter
    const q = newText.trim();
    setAllowCreatePicker(false);
    setShowCreatePicker(false);
    if (intellisenseTimerRef.current) { window.clearTimeout(intellisenseTimerRef.current); intellisenseTimerRef.current = null; }
    if (q.length >= 2) {
      setIntellisenseQuery(newText);
      intellisenseTimerRef.current = window.setTimeout(() => {
        if (!suppressIntellisenseRef.current) setShowIntellisense(true);
      }, 100);
    } else {
      setShowIntellisense(false);
      setIntellisenseQuery('');
    }
  };

  // Common handler invoked by keyboard or mouse pick
  const handlePickType = async (key: string) => {
    setShowCreatePicker(false);
    setAllowCreatePicker(false);
    setShowIntellisense(false);
    const label = (currentText || '').trim();
    if (!label) { setIsEditing(false); return; }
    const immediate = (patch: any) => {
      if (onUpdateWithCategory) {
        (onUpdateWithCategory as any)(row, label, 'agentActs', patch);
      } else {
        onUpdate(row, label);
      }
    };
    setIsEditing(false);
    await createAndAttachAct({
      name: label,
      type: key,
      scope: 'industry',
      projectData,
      onImmediateRowUpdate: immediate,
      getProjectId: () => (getProjectId ? getProjectId() : null)
    });
    try { emitSidebarRefresh(); } catch {}
  };

  const handleIntellisenseSelect = async (item: IntellisenseItem) => {
    console.log('[🔍 INTELLISENSE] handleIntellisenseSelect called', {
      itemName: item.name,
      itemCategoryType: item.categoryType,
      rowId: row.id,
      nodeCanvasPosition,
      timestamp: Date.now()
    });
    
    setCurrentText(item.name);
    console.log('[🔍 INTELLISENSE] Closing intellisense', {
      itemName: item.name,
      rowId: row.id,
      timestamp: Date.now()
    });
    setShowIntellisense(false);
    setIntellisenseQuery('');
    // Auto-save the selection with category type (legacy path keeps row label)
    if (onUpdateWithCategory) {
      console.log('[🔍 INTELLISENSE] Calling onUpdateWithCategory', {
        rowId: row.id,
        itemName: item.name,
        categoryType: item.categoryType
      });
      (onUpdateWithCategory as any)(row, item.name, item.categoryType, {
        actId: item.actId,
        factoryId: item.factoryId,
        type: (item as any)?.type,
        mode: (item as any)?.mode,
        userActs: item.userActs,
        categoryType: item.categoryType,
        baseActId: item.actId
      });
    } else {
      console.log('[🔍 INTELLISENSE] Calling onUpdate', {
        rowId: row.id,
        itemName: item.name
      });
      onUpdate(row, item.name);
    }
    // Create instance asynchronously (best-effort)
    try {
      let pid: string | undefined = undefined;
      try { pid = ((require('../../state/runtime') as any).getCurrentProjectId?.() || undefined); } catch {}
      if (pid && item.actId && item.categoryType === 'agentActs') {
    // Avoid require in browser; import mapping helpers at top-level
    const chosenType = (item as any)?.type || modeToType((item as any)?.mode);
    const modeFromType = typeToMode(chosenType);
        const inst = await ProjectDataService.createInstance(pid, { baseActId: item.actId, mode: (item as any)?.mode || (modeFromType as any) });
        if (inst && (onUpdateWithCategory as any)) {
          (onUpdateWithCategory as any)(row, item.name, item.categoryType, { instanceId: inst._id, baseActId: item.actId, type: chosenType, mode: (item as any)?.mode || modeFromType });
        }
      }
    } catch (e) { try { console.warn('[Row][instance:create] failed', e); } catch {} }
    console.log('[🔍 INTELLISENSE] Exiting editing mode', {
      rowId: row.id,
      itemName: item.name,
      timestamp: Date.now()
    });
    setIsEditing(false);
    setShowCreatePicker(false);
  };

  const handleIntellisenseClose = () => {
    setShowIntellisense(false);
    setIntellisenseQuery('');
    setShowCreatePicker(false);
  };

  // Removed previous force-visible effects for toolbar while picker is open.

  const handleDoubleClick = (e?: React.MouseEvent) => {
    setIsEditing(true);
  };

  // Open type picker when clicking the label icon (outside editing)
  const [pickerCurrentType, setPickerCurrentType] = useState<string | undefined>(undefined);

  const openTypePickerFromIcon = (anchor?: DOMRect, currentType?: string) => {
    const rect = anchor || labelRef.current?.getBoundingClientRect();
    if (!rect) { return; }
    // Position menu close to icon with minimal padding to avoid right whitespace
    const finalPos = { left: rect.left, top: (rect as any).bottom } as { left: number; top: number };
    console.log('[Picker][open]', { anchor: { x: rect.left, y: rect.top, w: rect.width, h: rect.height }, currentType });
    setNodeOverlayPosition(finalPos);
    setShowIntellisense(false);
    setAllowCreatePicker(true);
    // keep toolbar visible while submenu is open
    setShowIcons(true);
    setShowCreatePicker(true);
    setPickerCurrentType(currentType);
    // close on outside click (not when moving between toolbar and picker)
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node | null;
      const toolbarEl = typeToolbarRef.current as unknown as HTMLElement | null;
      const overToolbar = !!(toolbarEl && target && toolbarEl instanceof Node && toolbarEl.contains(target as Node));
      const rowEl = nodeContainerRef.current as HTMLElement | null;
      const overRow = !!(rowEl && target && target instanceof Node && rowEl.contains(target as Node));
      const overlayEl = overlayRef.current as HTMLElement | null;
      const overOverlay = !!(overlayEl && target && target instanceof Node && overlayEl.contains(target as Node));
      console.log('[Picker][docClick]', { overToolbar, overRow, overOverlay, targetTag: (ev.target as HTMLElement)?.tagName, class: (ev.target as HTMLElement)?.className });
      if (overToolbar || overRow || overOverlay) return; // clicks inside picker, row, or toolbar overlay should NOT close
      console.log('[Picker][close] docClick outside → close picker');
      setShowCreatePicker(false);
      document.removeEventListener('mousedown', onDocClick, true);
      window.removeEventListener('mousemove', onMoveCloseIfFar, true);
    };
    document.addEventListener('mousedown', onDocClick, true);

    // close when moving far from row, toolbar and menu (proximity buffer)
    const onMoveCloseIfFar = (e: MouseEvent) => {
      const pt = { x: e.clientX, y: e.clientY };
      const rowRect = nodeContainerRef.current?.getBoundingClientRect() || null;
      const tbRect = overlayRef.current ? overlayRef.current.getBoundingClientRect() : (iconPos ? getToolbarRect(iconPos.left, iconPos.top, labelRef.current, 180) : null);
      const menuRect = (typeToolbarRef.current && (typeToolbarRef.current as any).getBoundingClientRect) ? (typeToolbarRef.current as any).getBoundingClientRect() : null;
      const nearRow = isInsideWithPadding(pt, rowRect, 20);
      const nearToolbar = isInsideWithPadding(pt, tbRect, 24);
      const nearMenu = isInsideWithPadding(pt, menuRect, 20);
      if (!nearRow && !nearToolbar && !nearMenu) {
        setShowCreatePicker(false);
        window.removeEventListener('mousemove', onMoveCloseIfFar, true);
        document.removeEventListener('mousedown', onDocClick, true);
        setShowIcons(false);
      } else {
        setShowIcons(true);
      }
    };
    window.addEventListener('mousemove', onMoveCloseIfFar, true);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (onDragStart) {
      const fromRef = (ref && 'current' in ref && ref.current) ? ref.current.getBoundingClientRect() : null;
      const fromNode = nodeContainerRef.current ? nodeContainerRef.current.getBoundingClientRect() : null;
      const fallback = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const rect = fromRef || fromNode || fallback;
      onDragStart(row.id, index, e.clientX, e.clientY, rect);
    }
  };

  // Also support simple immediate reordering by dragging label vertically:
  // compute target index from cursor Y over siblings and call onMoveRow during drag; onDropRow at end.
  useEffect(() => {
    if (!('current' in nodeContainerRef) || !nodeContainerRef.current) return;
    const el = nodeContainerRef.current;
    let dragging = false;
    let startY = 0;
    const onDown = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement;
      if (!t || !(t.closest && t.closest('.node-row-outer'))) return;
      dragging = true;
      startY = ev.clientY;
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragging || typeof onMoveRow !== 'function') return;
      const rows = Array.from((el.parentElement || document).querySelectorAll('.node-row-outer')) as HTMLElement[];
      const rects = rows.map((r, i) => ({ idx: i, top: r.getBoundingClientRect().top, h: r.getBoundingClientRect().height }));
      let to = index;
      for (const r of rects) { if (ev.clientY < r.top + r.h / 2) { to = r.idx; break; } to = r.idx + 1; }
      if (to !== index) {
        onMoveRow(index, to);
      }
    };
    const onUp = () => {
      if (dragging && typeof onDropRow === 'function') onDropRow();
      dragging = false;
    };
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove, { capture: true });
    window.addEventListener('mouseup', onUp, { capture: true });
    return () => {
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove as any, { capture: true } as any);
      window.removeEventListener('mouseup', onUp as any, { capture: true } as any);
    };
  }, [index, onMoveRow, onDropRow]);

  // Ghost preview while dragging
  useEffect(() => {
    if (!isBeingDragged) return;
    const ghost = document.createElement('div');
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.opacity = '0.75';
    ghost.style.zIndex = '1001';
    ghost.style.background = 'rgba(71,85,105,0.9)';
    ghost.style.color = '#fff';
    ghost.style.borderRadius = '6px';
    ghost.style.padding = '2px 6px';
    ghost.style.boxShadow = '0 4px 12px rgba(0,0,0,0.35)';
    ghost.textContent = row.text || '';
    document.body.appendChild(ghost);

    const move = (ev: MouseEvent) => {
      ghost.style.top = ev.clientY + 8 + 'px';
      ghost.style.left = ev.clientX + 8 + 'px';
    };
    document.addEventListener('mousemove', move);
    return () => {
      document.removeEventListener('mousemove', move);
      document.body.removeChild(ghost);
    };
  }, [isBeingDragged, row.text]);

  // Stili condizionali
  let conditionalStyles: React.CSSProperties = {};
  let conditionalClasses = '';

  if (isPlaceholder) {
    conditionalStyles = {
      display: 'none'
    };
  } else if (isBeingDragged) {
    conditionalStyles = {
      ...style,
      position: 'relative',
      zIndex: 0,
      opacity: 1,
      boxShadow: 'none',
      backgroundColor: 'transparent',
      outline: '1px dashed #94a3b8',
      outlineOffset: 2,
      pointerEvents: 'auto'
    };
  }

  // Colore solo testo come in sidebar; sfondo trasparente
  let bgColor = 'transparent';
  let labelTextColor = '';

  // Icona e colore coerenti con la sidebar
  const { data: projectData } = useProjectData();
  let resolvedCategoryType: string | undefined = (row as any).categoryType;
  let actFound: any = null;
  if ((row as any).actId || (row as any).baseActId || (row as any).factoryId) {
    actFound = findAgentAct(projectData, row);
    if (actFound) resolvedCategoryType = 'agentActs';
  }

  const isAgentAct = resolvedCategoryType === 'agentActs';

  let Icon: React.ComponentType<any> | null = null;
  let currentTypeForPicker: string | undefined = undefined;

  if (isAgentAct) {
    const typeResolved = resolveActType(row as any, actFound) as any;
    currentTypeForPicker = typeResolved;
    const has = hasActDDT(row as any, actFound);
    // silent by default; enable only if strictly needed
    // try { if (localStorage.getItem('debug.mode')) console.log('[Type][NodeRow]', { rowId: row.id, text: row.text, type, hasDDT: has, actFound: !!actFound }); } catch {}
    const visuals = getAgentActVisualsByType(typeResolved, has);
    Icon = visuals.Icon;
    labelTextColor = visuals.color;
  } else {
    const c = row.categoryType ? (SIDEBAR_TYPE_COLORS as any)[row.categoryType] : null;
    labelTextColor = (c && (c.color || '#111')) || (typeof propTextColor === 'string' ? propTextColor : '');
    if (!labelTextColor) {
      const colorObj = getLabelColor(row.categoryType || '', row.userActs);
      labelTextColor = colorObj.text;
    }
    const iconKey = row.categoryType ? (SIDEBAR_TYPE_ICONS as any)[row.categoryType] : null;
    Icon = iconKey ? getSidebarIconComponent(iconKey) : null;
  }

  // LOG: stampa id, forceEditing, isEditing
  useEffect(() => {
    // console.log(`[NodeRow] render row.id=${row.id} forceEditing=${forceEditing} isEditing=${isEditing}`);
  });

  // Editor host context (for opening the right editor per ActType) - host is always present
  const actEditorCtx = useActEditor();

  // Icon già determinata sopra

  return (
    <>
      {/* Zona buffer ESTESA per tolleranza spaziale: riga + toolbar + 7px padding */}
      {bufferRect && showIcons && !showCreatePicker && !isEditing && createPortal(
        <div
          style={{
            position: 'fixed',
            top: bufferRect.top,
            left: bufferRect.left,
            width: bufferRect.width,
            height: bufferRect.height,
            zIndex: 499, // Sotto la toolbar (1000) ma sopra il contenuto normale
            pointerEvents: 'auto', // Cattura hover per mantenere toolbar visibile
            background: 'transparent',
            // Debug: mostra l'area (rimuovere in produzione)
            // border: '1px dashed rgba(0, 255, 0, 0.3)',
          }}
          onMouseEnter={() => {
            console.log('[HoverArea] Mouse entered extended area');
            toolbarSM.row.onEnter(); // Mantieni toolbar visibile
          }}
          onMouseLeave={(e) => {
            console.log('[HoverArea] Mouse left extended area');
            toolbarSM.row.onLeave(e as any);
          }}
        />,
        document.body
      )}
      <div 
        ref={nodeContainerRef}
        className={`node-row-outer flex items-center group transition-colors ${conditionalClasses}`}
        style={{ ...conditionalStyles, backgroundColor: 'transparent', border: 'none', outline: 'none', boxShadow: 'none', paddingLeft: 0, paddingRight: 0, marginTop: 0, marginBottom: 0, paddingTop: 4, paddingBottom: 4, minHeight: 0, height: 'auto', width: '100%' }}
        data-index={index}
        onMouseEnter={() => toolbarSM.row.onEnter()}
        onMouseLeave={(e) => toolbarSM.row.onLeave(e as any)}
        {...(onMouseMove ? { onMouseMove } : {})}
      >
      {isEditing ? (
        <div style={{ flex: 1, minWidth: 0 }}>
        <NodeRowEditor
          value={currentText}
          onChange={handleTextChange}
          onKeyDown={handleKeyDownInternal}
          inputRef={inputRef}
          placeholder="Type what you need here..."
        />
        </div>
      ) : (
          <NodeRowLabel
            row={row}
            included={included}
            setIncluded={val => {
              setIncluded(val);
              if (typeof onUpdate === 'function') {
                onUpdate({ ...row, included: val }, row.text);
              }
            }}
            labelRef={labelRef}
            Icon={Icon}
            iconSize={Math.max(10, Math.min(18, Math.round(12 * getZoom())))}
            showIcons={toolbarSM.showIcons}
                iconPos={iconPos}
                canDelete={canDelete}
                onEdit={() => enterEditing()}
                onDelete={() => onDelete(row)}
                onDrag={handleMouseDown}
                onLabelDragStart={handleMouseDown}
                isEditing={isEditing}
                setIsEditing={setIsEditing}
            bgColor={bgColor}
            labelTextColor={labelTextColor}
            hasDDT={hasActDDT(row as any, actFound)}
            gearColor={labelTextColor}
          onOpenDDT={async () => {
            try {
              console.log('[DDT][open] request', { rowId: row.id, text: row.text });
            } catch {}
            try {
              // Open ActEditorHost (envelope) which routes to the correct sub-editor by ActType
              const baseId = (row as any).baseActId || (row as any).actId || (row as any).factoryId || row.id;
              const type = resolveActType(row as any, actFound) as any;
              // Host present → open deterministically
              actEditorCtx.open({ id: String(baseId), type, label: row.text });
              console.log('[DDT][open] done', { baseId, type });
              return;
            } catch (e) { console.warn('[Row][openDDT] failed', e); }
          }}
            onDoubleClick={handleDoubleClick}
            onIconsHoverChange={(v: boolean) => { v ? toolbarSM.overlay.onEnter() : toolbarSM.overlay.onLeave(); }}
            onLabelHoverChange={(v: boolean) => { v ? toolbarSM.row.onEnter() : toolbarSM.row.onLeave({ relatedTarget: null } as any); }}
            onTypeChangeRequest={(anchor) => openTypePickerFromIcon(anchor, currentTypeForPicker)}
            onRequestClosePicker={() => setShowCreatePicker(false)}
            overlayRef={overlayRef}
          />
        )}
        </div>
      
      <NodeRowIntellisense
        showIntellisense={showIntellisense}
        isEditing={isEditing}
        nodeOverlayPosition={nodeOverlayPosition}
        intellisenseQuery={intellisenseQuery}
        inputRef={inputRef}
        handleIntellisenseSelect={handleIntellisenseSelect}
        handleIntellisenseClose={handleIntellisenseClose}
        allowCreatePicker={false}
        onCreateAgentAct={onCreateAgentAct}
        onCreateBackendCall={onCreateBackendCall}
        onCreateTask={onCreateTask}
      />

      {toolbarSM.showPicker && nodeOverlayPosition && createPortal(
        <>
          <TypePickerToolbar
            left={nodeOverlayPosition.left}
            top={nodeOverlayPosition.top}
            onPick={(key) => handlePickType(key)}
            rootRef={typeToolbarRef}
            currentType={pickerCurrentType}
            onRequestClose={() => setShowCreatePicker(false)}
          />
        </>, document.body
      )}
    </>
  );
};

export const NodeRow = React.forwardRef(NodeRowInner);