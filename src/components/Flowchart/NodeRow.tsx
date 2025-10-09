import React, { useState, useEffect, useRef } from 'react';
import { useProjectData } from '../../context/ProjectDataContext';
import { useDDTManager } from '../../context/DDTManagerContext';
import { ProjectDataService } from '../../services/ProjectDataService';
import { EntityCreationService } from '../../services/EntityCreationService';
import { createPortal } from 'react-dom';
import { useReactFlow } from 'reactflow';
import { Ear, CheckCircle2, Megaphone, GitBranch, FileText, Server } from 'lucide-react';
import { SIDEBAR_TYPE_ICONS, getSidebarIconComponent } from '../Sidebar/sidebarTheme';
import { IntellisenseItem } from '../Intellisense/IntellisenseTypes';
import { getLabelColor } from '../../utils/labelColor';
import { useOverlayBuffer } from '../../hooks/useOverlayBuffer';
import { NodeRowEditor } from './NodeRowEditor';
import { NodeRowProps } from '../../types/NodeRowTypes';
import { SIDEBAR_TYPE_COLORS } from '../Sidebar/sidebarTheme';
import { NodeRowLabel } from './NodeRowLabel';
import { NodeRowIntellisense } from './NodeRowIntellisense';
import { getAgentActVisualsByType, findAgentAct, resolveActMode, resolveActType, hasActDDT } from './actVisuals';
import { modeToType, typeToMode } from '../../utils/normalizers';

export const NodeRow = React.forwardRef<HTMLDivElement, NodeRowProps>((
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
  onCreateTask
  },
  ref
) => {
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
  const { openDDT } = useDDTManager();
  const hoverHideTimerRef = useRef<number | null>(null);

  // Calcola la posizione e dimensione della zona buffer
  const bufferRect = useOverlayBuffer(labelRef, iconPos, showIcons);

  // Helper per entrare in editing
  const enterEditing = () => {
    setIsEditing(true);
  };

  // Quando entri in editing, calcola la posizione del nodo
  useEffect(() => {
    if (isEditing) {
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

  useEffect(() => {
    if (forceEditing) setIsEditing(true);
  }, [forceEditing]);

  // Debug disattivato di default (abilitabile via debug.flowIcons)
  useEffect(() => {
    // no-op
  }, [showIcons, row.id, iconPos, debugFlowIcons]);

  useEffect(() => {
    if (isEditing) {
      const attemptFocus = (i: number) => {
        const el = inputRef.current || (document.querySelector('.node-row-input') as HTMLInputElement | null);
        const exists = Boolean(el);
        try { if (el) { el.focus(); el.select(); } } catch {}
        if (!exists && i < 10) setTimeout(() => attemptFocus(i + 1), 25);
      };
      attemptFocus(0);
    }
  }, [isEditing]);

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
      const pid = (window as any).__currentProjectId || (window as any).__projectId;
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

  const handleKeyDownInternal = (e: React.KeyboardEvent) => {
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
          const { useProjectData } = require('../../context/ProjectDataContext');
          const { data: projectData } = useProjectData();
          const { EntityCreationService } = require('../../services/EntityCreationService');
          const created = EntityCreationService.createCondition({
            name: q,
            projectData,
            projectIndustry: (projectData as any)?.industry,
            scope: 'industry'
          });
          if (created) {
            try { console.log('[CondFlow] row.update', { id: created?.id, name: q }); } catch {}
            if (onUpdateWithCategory) {
              (onUpdateWithCategory as any)(row, q, 'conditions', { conditionId: created.id });
            } else {
              onUpdate(row, q);
            }
            setIsEditing(false);
            setShowIntellisense(false);
            setIntellisenseQuery('');
            try {
              console.log('[CondFlow] sidebar.refresh');
              document.dispatchEvent(new CustomEvent('sidebar:refresh', { bubbles: true }));
              document.dispatchEvent(new CustomEvent('sidebar:forceRender', { bubbles: true }));
            } catch {}
          }
        } catch (err) {
          try { console.warn('[CondFlow] quick-create failed', err); } catch {}
        }
        return;
      }

      // Agent Acts: apri intellisense (se chiuso) e abilita il picker di creazione
      if (dbg) try { console.log('[Picker][Enter]', { q, showIntellisense, beforeAllowCreatePicker: allowCreatePicker, beforeShowCreatePicker: showCreatePicker }); } catch {}
      setIntellisenseQuery(q);
      setShowIntellisense(true);
      setAllowCreatePicker(true);
      setShowCreatePicker(true);
      if (dbg) try { console.log('[Picker][Enter->state]', { afterAllowCreatePicker: true, afterShowCreatePicker: true }); } catch {}
      return;
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
    if (q.length > 0) {
      setIntellisenseQuery(newText);
      setShowIntellisense(true);
    } else {
      setShowIntellisense(false);
      setIntellisenseQuery('');
    }
  };

  const handleIntellisenseSelect = async (item: IntellisenseItem) => {
    setCurrentText(item.name);
    setShowIntellisense(false);
    setIntellisenseQuery('');
    // Auto-save the selection with category type (legacy path keeps row label)
    if (onUpdateWithCategory) {
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
      onUpdate(row, item.name);
    }
    // Create instance asynchronously (best-effort)
    try {
      const pid = (window as any).__currentProjectId || (window as any).__projectId;
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
    setIsEditing(false);
    setShowCreatePicker(false);
  };

  const handleIntellisenseClose = () => {
    setShowIntellisense(false);
    setIntellisenseQuery('');
    setShowCreatePicker(false);
  };

  const handleDoubleClick = (e?: React.MouseEvent) => {
    try { console.log('[NodeRow][dblclick] label', { rowId: row.id, target: (e?.target as any)?.className }); } catch {}
    setIsEditing(true);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (onDragStart) {
      const fromRef = (ref && 'current' in ref && ref.current) ? ref.current.getBoundingClientRect() : null;
      const fromNode = nodeContainerRef.current ? nodeContainerRef.current.getBoundingClientRect() : null;
      const fallback = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const rect = fromRef || fromNode || fallback;
      try { console.log('[RowDrag][mouseDown]', { rowId: row.id, index, client: { x: e.clientX, y: e.clientY }, rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height } }); } catch {}
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
    try { console.log('[RowDrag][ghost:create]', { rowId: row.id }); } catch {}
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
      try { console.log('[RowDrag][ghost:remove]', { rowId: row.id }); } catch {}
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

  if (isAgentAct) {
    const type = resolveActType(row as any, actFound) as any;
    const has = hasActDDT(row as any, actFound);
    try { if (localStorage.getItem('debug.mode')) console.log('[Type][NodeRow]', { rowId: row.id, text: row.text, type, hasDDT: has, actFound: !!actFound }); } catch {}
    const visuals = getAgentActVisualsByType(type, has);
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

  // Icon già determinata sopra

  return (
    <>
      {/* Zona buffer invisibile per tolleranza spaziale */}
      {bufferRect && showIcons && createPortal(
        <div
          style={{
            position: 'fixed',
            top: bufferRect.top,
            left: bufferRect.left,
            width: bufferRect.width,
            height: bufferRect.height,
            zIndex: 9998,
            pointerEvents: 'auto',
            background: 'transparent',
          }}
          onMouseEnter={() => {
            if (hoverHideTimerRef.current) window.clearTimeout(hoverHideTimerRef.current);
            setShowIcons(true);
          }}
          onMouseLeave={() => {
            if (hoverHideTimerRef.current) window.clearTimeout(hoverHideTimerRef.current);
            hoverHideTimerRef.current = window.setTimeout(() => setShowIcons(false), 120);
          }}
        />,
        document.body
      )}
      <div 
        ref={nodeContainerRef}
        className={`node-row-outer flex items-center group transition-colors ${conditionalClasses}`}
        style={{ ...conditionalStyles, backgroundColor: 'transparent', border: 'none', outline: 'none', boxShadow: 'none', paddingLeft: 0, paddingRight: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, minHeight: 0, height: 'auto', width: '100%' }}
        data-index={index}
        onMouseEnter={() => {
          if (hoverHideTimerRef.current) window.clearTimeout(hoverHideTimerRef.current);
          setShowIcons(true);
        }}
        onMouseLeave={() => {
          if (hoverHideTimerRef.current) window.clearTimeout(hoverHideTimerRef.current);
          hoverHideTimerRef.current = window.setTimeout(() => setShowIcons(false), 120);
        }}
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
            showIcons={showIcons}
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
              const { data: projectData } = (require('../../context/ProjectDataContext') as any).useProjectData();
            } catch {}
            try {
              // Best-effort: trova act nel projectData corrente esposto globalmente
              const pd: any = (window as any).__projectData;
              const baseId = (row as any).baseActId || (row as any).actId;
              let act: any = null;
              if (pd && pd.agentActs) {
                for (const cat of pd.agentActs) {
                  const f = (cat.items || []).find((it: any) => it.id === baseId || it._id === baseId || it.id === (row as any).factoryId);
                  if (f) { act = f; break; }
                }
              }
              const ddt = act?.ddt || act?.ddtSnapshot || (row as any)?.ddt;
              console.log('[Row][openDDT] click', { rowId: row.id, mode: (row as any)?.mode, baseActId: baseId, hasDDT: !!ddt, instanceId: (row as any)?.instanceId });
              if (ddt) {
                openDDT(ddt);
              } else {
                // Message (non-interactive): apertura istantanea con cache locale
                const templateText = ((row as any)?.message?.text) ?? (row.text || '');
                try {
                  console.log('[Row][openDDT] open NonInteractive', { title: row.text || 'Agent message', templateText });
                  document.dispatchEvent(new CustomEvent('nonInteractiveEditor:open', { detail: { title: row.text || 'Agent message', template: templateText, instanceId: (row as any)?.instanceId } }));
                } catch {}
              }
            } catch (e) { console.warn('[Row][openDDT] failed', e); }
          }}
            onDoubleClick={handleDoubleClick}
            onIconsHoverChange={(v: boolean) => {
              if (hoverHideTimerRef.current) window.clearTimeout(hoverHideTimerRef.current);
              if (v) setShowIcons(true);
              else hoverHideTimerRef.current = window.setTimeout(() => setShowIcons(false), 120);
            }}
            onLabelHoverChange={(v: boolean) => {
              if (hoverHideTimerRef.current) window.clearTimeout(hoverHideTimerRef.current);
              if (v) setShowIcons(true);
              else hoverHideTimerRef.current = window.setTimeout(() => setShowIcons(false), 120);
            }}
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

      {showCreatePicker && isEditing && nodeOverlayPosition && createPortal(
        <div
          className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-xl p-2"
          style={{ left: nodeOverlayPosition.left, top: (nodeOverlayPosition.top + 40), minWidth: 300 }}
        >
          <div className="grid grid-cols-3 gap-2">
            {[{ key: 'Message', label: 'Message', Icon: Megaphone, color: '#34d399' },
              { key: 'DataRequest', label: 'Data', Icon: Ear, color: '#3b82f6' },
              { key: 'Confirmation', label: 'Confirmation', Icon: CheckCircle2, color: '#6366f1' },
              { key: 'ProblemClassification', label: 'Problem', Icon: GitBranch, color: '#f59e0b' },
              { key: 'Summarizer', label: 'Summarizer', Icon: FileText, color: '#06b6d4' },
              { key: 'BackendCall', label: 'BackendCall', Icon: Server, color: '#94a3b8' }].map(({ key, label, Icon, color }) => (
              <button
                key={key}
                className="px-4 py-2 border rounded-md bg-white hover:bg-slate-50 flex items-center gap-2 text-xs whitespace-nowrap"
                style={{ minWidth: 180 }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try { (window as any).__chosenActType = key; (window as any).__suppressEditorOnce = true; } catch {}
                  try { console.log('[CreateFlow] click', { type: key, text: (currentText || '').trim() }); } catch {}
                  // Chiudi subito overlay e intellisense per feedback immediato
                  setShowCreatePicker(false);
                  setAllowCreatePicker(false);
                  setShowIntellisense(false);
                  const createRowUpdateCallback = (created: any) => {
                    try { console.log('[CreateFlow] row.update', { id: created?.id, type: (created as any)?.type, mode: (created as any)?.mode }); } catch {}
                    handleIntellisenseSelect({
                      id: `agentActs-${created.id}`,
                      actId: created.actId || created.id,
                      factoryId: created.factoryId,
                      label: created.name,
                      shortLabel: created.name,
                      name: created.name,
                      description: '',
                      category: 'Root',
                      categoryType: 'agentActs',
                      mode: created.mode,
                      type: key as any,
                    } as any);
                  };
                  try {
                    const created = EntityCreationService.createAgentAct({
                      name: (currentText || '').trim(),
                      projectData,
                      projectIndustry: (projectData as any)?.industry,
                      scope: 'industry'
                    });
                    if (created) {
                      try { console.log('[CreateFlow] service.created', { id: (created as any)?.id, type: (created as any)?.type }); } catch {}
                      createRowUpdateCallback(created);
                      try {
                        console.log('[CreateFlow] sidebar.refresh');
                        const ev = new CustomEvent('sidebar:refresh', { bubbles: true });
                        document.dispatchEvent(ev);
                      } catch {}
                    } else if (onCreateAgentAct) {
                      onCreateAgentAct((currentText || '').trim(), createRowUpdateCallback, 'industry');
                    } else if (onUpdateWithCategory) {
                      (onUpdateWithCategory as any)(row, (currentText || '').trim(), 'agentActs', { type: key as any });
                      setIsEditing(false);
                    }
                  } catch {
                    if (onCreateAgentAct) {
                      onCreateAgentAct((currentText || '').trim(), createRowUpdateCallback, 'industry');
                    } else if (onUpdateWithCategory) {
                      (onUpdateWithCategory as any)(row, (currentText || '').trim(), 'agentActs', { type: key as any });
                      setIsEditing(false);
                    }
                  }
                }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
              >
                <Icon className="w-4 h-4" style={{ color }} />
                <span className="text-slate-700">{label}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
});