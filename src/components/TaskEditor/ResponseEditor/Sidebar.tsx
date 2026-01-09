import React, { forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, Pencil, Trash2 } from 'lucide-react';
import { getLabel, getSubDataList } from './ddtSelectors';
import getIconComponent from './icons';
import styles from './ResponseEditor.module.css';
import { useFontContext } from '../../../context/FontContext';
import { useProjectTranslations } from '../../../context/ProjectTranslationsContext';

interface SidebarProps {
  mainList: any[];
  selectedMainIndex: number;
  onSelectMain: (idx: number) => void;
  selectedSubIndex?: number | null;
  onSelectSub?: (idx: number | undefined, mainIdx?: number) => void;
  aggregated?: boolean;
  rootLabel?: string;
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
}

const Sidebar = forwardRef<HTMLDivElement, SidebarProps>(function Sidebar({ mainList, selectedMainIndex, onSelectMain, selectedSubIndex, onSelectSub, aggregated, rootLabel = 'Data', onSelectAggregator, onChangeSubRequired, onReorderSub, onAddMain, onRenameMain, onDeleteMain, onAddSub, onRenameSub, onDeleteSub, onWidthChange, style }, ref) {
  const { combinedClass } = useFontContext();
  const { translations } = useProjectTranslations(); // ✅ Get translations for node labels
  const dbg = (...args: any[]) => { try { if (localStorage.getItem('debug.sidebar') === '1') console.log(...args); } catch {} };
  if (!Array.isArray(mainList) || mainList.length === 0) return null;
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

  // Sync expanded state when external selection changes
  React.useEffect(() => {
    if (selectedMainIndex !== expandedMainIndex) {
      setExpandedMainIndex(selectedMainIndex);
    }
  }, [selectedMainIndex]);

  const safeSelectedSubIndex = typeof selectedSubIndex === 'number' && !isNaN(selectedSubIndex) ? selectedSubIndex : undefined;

  // Keyboard navigation between mains and subs
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let handled = false;
    const flatList: Array<{ type: 'main' | 'sub'; mainIdx: number; subIdx?: number }> = [];
    mainList.forEach((main, mIdx) => {
      flatList.push({ type: 'main', mainIdx: mIdx });
      const subs = getSubDataList(main) || [];
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

  const itemStyle = (active: boolean, isSub: boolean, disabled?: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: 'fit-content',
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
  });

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const dragStateRef = React.useRef<{ mainIdx: number | null; fromIdx: number | null }>({ mainIdx: null, fromIdx: null });
  const forwarded = ref as any;
  React.useEffect(() => { if (forwarded) forwarded.current = containerRef.current; }, [forwarded]);
  // ✅ FIX: Parti da null invece di 280 per evitare flash e misure sbagliate
  const [measuredW, setMeasuredW] = React.useState<number | null>(null);
  const [hoverRoot, setHoverRoot] = React.useState<boolean>(false);
  const [hoverMainIdx, setHoverMainIdx] = React.useState<number | null>(null);
  const [hoverSub, setHoverSub] = React.useState<{ mainIdx: number; subIdx: number } | null>(null);
  const [addingMain, setAddingMain] = React.useState<boolean>(false);
  const [addingSubFor, setAddingSubFor] = React.useState<number | null>(null);
  const [draftLabel, setDraftLabel] = React.useState<string>('');
  const [editingMainIdx, setEditingMainIdx] = React.useState<number | null>(null);
  const [editingSub, setEditingSub] = React.useState<{ mainIdx: number; subIdx: number } | null>(null);
  const [editDraft, setEditDraft] = React.useState<string>('');
  const [overlay, setOverlay] = React.useState<null | { type: 'root' | 'main' | 'sub'; mainIdx?: number; subIdx?: number; top: number; left: number }>(null);
  const hideTimerRef = React.useRef<number | null>(null);
  const overlayHoverRef = React.useRef<boolean>(false);
  const hoverRootRef = React.useRef<boolean>(false);
  const hoverMainIdxRef = React.useRef<number | null>(null);
  const hoverSubRef = React.useRef<{ mainIdx: number; subIdx: number } | null>(null);
  React.useEffect(() => { hoverRootRef.current = hoverRoot; }, [hoverRoot]);
  React.useEffect(() => { hoverMainIdxRef.current = hoverMainIdx; }, [hoverMainIdx]);
  React.useEffect(() => { hoverSubRef.current = hoverSub; }, [hoverSub]);
  const maybeHideOverlay = (delay: number = 320) => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      const stillHoveringItem = !!hoverRootRef.current || (hoverMainIdxRef.current !== null) || !!hoverSubRef.current;
      if (!overlayHoverRef.current && !stillHoveringItem) setOverlay(null);
    }, delay);
  };
  // ✅ DEBUG: Abilita log con localStorage.setItem('debug.sidebarResize', '1')
  const DEBUG_RESIZE = typeof localStorage !== 'undefined' && localStorage.getItem('debug.sidebarResize') === '1';

  // ✅ FIX: Leggi manualWidth da style prop (se presente)
  const manualWidth = React.useMemo(() => {
    if (!style?.width) return null;
    const w = typeof style.width === 'number' ? style.width : parseFloat(String(style.width));
    const result = Number.isFinite(w) && w > 0 ? w : null;
    if (DEBUG_RESIZE) console.log('📐 [SIDEBAR] manualWidth calcolato', {
      styleWidth: style?.width,
      parsed: w,
      result,
    });
    return result;
  }, [style?.width, DEBUG_RESIZE]);

  // ✅ DEBUG: Log quando manualWidth o measuredW cambiano
  React.useEffect(() => {
    if (DEBUG_RESIZE) console.log('📏 [SIDEBAR] manualWidth/measuredW cambiato', {
      manualWidth,
      measuredW,
      styleWidth: style?.width,
      finalWidth: manualWidth ?? measuredW ?? 'auto',
    });
  }, [manualWidth, measuredW, style?.width, DEBUG_RESIZE]);

  // ✅ FIX: useLayoutEffect per calcolare dopo il mount con font reale
  React.useLayoutEffect(() => {
    // Se c'è una larghezza manuale, NON calcolare autosize
    if (manualWidth !== null && manualWidth > 0) {
      if (DEBUG_RESIZE) console.log('⏸️ [SIDEBAR] manualWidth attivo, salto autosize', { manualWidth });
      // Non aggiornare measuredW se c'è manualWidth attivo
      return;
    }

    const el = containerRef.current;
    if (!el) return;
    if (!Array.isArray(mainList) || mainList.length === 0) {
      setMeasuredW(280); // Fallback
      return;
    }

    // ✅ FIX: Leggi il font reale dal container
    const computedStyle = window.getComputedStyle(el);
    const containerFont = computedStyle.font || `${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;

    // ✅ Funzione per misurare testo con font reale
    const measureTextWidth = (text: string, fontWeight: number = 400): number => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return text.length * 8;

      // ✅ Usa il font del container, ma modifica il fontWeight
      const fontParts = containerFont.split(' ');
      const baseFontSize = computedStyle.fontSize || '14px';
      const baseFontFamily = computedStyle.fontFamily || 'system-ui';
      context.font = `${fontWeight} ${baseFontSize} ${baseFontFamily}`;

      return context.measureText(text || '').width;
    };

    // ✅ FIX: Leggi costanti UI dal DOM invece di hardcoded
    // Prova a leggere da elementi esistenti, altrimenti usa fallback
    const getIconWidth = (): number => {
      // Cerca un'icona nel DOM per misurare
      const firstIcon = el.querySelector('svg, [class*="icon"]');
      if (firstIcon) {
        const rect = firstIcon.getBoundingClientRect();
        if (rect.width > 0) return rect.width;
      }
      return 20; // Fallback
    };

    const getPadding = (): { horizontal: number; vertical: number } => {
      const paddingLeft = parseFloat(computedStyle.paddingLeft) || 14;
      const paddingRight = parseFloat(computedStyle.paddingRight) || 14;
      const paddingTop = parseFloat(computedStyle.paddingTop) || 16;
      const paddingBottom = parseFloat(computedStyle.paddingBottom) || 16;
      return {
        horizontal: paddingLeft + paddingRight,
        vertical: paddingTop + paddingBottom
      };
    };

    const iconWidth = getIconWidth();
    const padding = getPadding();

    // Costanti derivate dal codice (con fallback)
    const CHECKBOX_WIDTH = 14 + 6; // Checkbox (14px) + marginRight (6px)
    const CHEVRON_WIDTH = 10 + 6; // Chevron SVG (10px) + marginLeft (6px)
    const BUTTON_PADDING_H = 10 + 10; // padding: '8px 10px' → left + right
    const SUB_INDENT = 36; // marginLeft per sub-items
    const MAIN_INDENT_AGGREGATED = 18; // marginLeft per main items quando aggregated
    const GAP = 10; // gap tra icona e testo
    const GUTTER = 15; // spazio extra

    let maxWidth = 0;

    // ✅ 1. Calcola larghezza massima dei main items
    mainList.forEach((main, idx) => {
      const label = getLabel(main, translations);
      const labelWidth = measureTextWidth(label, selectedMainIndex === idx ? 700 : 400);
      const subs = getSubDataList(main) || [];
      const hasSubs = subs.length > 0;

      let mainWidth = iconWidth + GAP + labelWidth;

      if (aggregated) mainWidth += CHECKBOX_WIDTH;
      if (hasSubs) mainWidth += CHEVRON_WIDTH;
      mainWidth += BUTTON_PADDING_H;
      if (aggregated) mainWidth += MAIN_INDENT_AGGREGATED;

      if (mainWidth > maxWidth) maxWidth = mainWidth;

      // ✅ 2. Se questo main è espanso, calcola anche i suoi sub-items
      if (expandedMainIndex === idx && hasSubs) {
        subs.forEach((sub: any, sidx: number) => {
          const subLabel = getLabel(sub, translations);
          const isSubActive = selectedMainIndex === idx && safeSelectedSubIndex === sidx;
          const subLabelWidth = measureTextWidth(subLabel, isSubActive ? 700 : 400);

          let subWidth = SUB_INDENT + iconWidth + GAP + subLabelWidth;
          subWidth += CHECKBOX_WIDTH;
          subWidth += BUTTON_PADDING_H;

          if (subWidth > maxWidth) maxWidth = subWidth;
        });
      }
    });

    // ✅ 3. Considera anche il root label se aggregated
    if (aggregated && rootLabel) {
      const rootLabelWidth = measureTextWidth(rootLabel, 700);
      const rootWidth = iconWidth + GAP + rootLabelWidth + BUTTON_PADDING_H;
      if (rootWidth > maxWidth) maxWidth = rootWidth;
    }

    // ✅ 4. Aggiungi padding del container e gutter
    maxWidth += padding.horizontal;
    maxWidth += GUTTER;

    // ✅ 5. Clamp tra min e max
    const totalWidth = Math.ceil(maxWidth);
    const clamped = Math.min(Math.max(totalWidth, 200), 640);

    if (DEBUG_RESIZE) console.log('📊 [SIDEBAR] Calcolo autosize completato', {
      maxWidth,
      totalWidth,
      clamped,
      manualWidth,
      willSet: manualWidth === null || manualWidth === 0,
    });

    if (manualWidth === null || manualWidth === 0) {
      setMeasuredW(clamped);
    }
  }, [mainList, expandedMainIndex, aggregated, rootLabel, translations, selectedMainIndex, safeSelectedSubIndex, manualWidth, DEBUG_RESIZE]);

  // ✅ DEBUG: Log quando finalWidth cambia
  const finalWidth = manualWidth ?? measuredW ?? 'auto';
  const hasFlex = !manualWidth; // ✅ CRITICO: Rimuovi flex: 1 quando c'è manualWidth
  React.useEffect(() => {
    if (DEBUG_RESIZE) console.log('🎨 [SIDEBAR] Render con width finale', {
      manualWidth,
      measuredW,
      finalWidth,
      styleWidth: style?.width,
      hasFlex,
      containerRefExists: !!containerRef.current,
      actualWidth: containerRef.current?.getBoundingClientRect().width,
    });
  }, [finalWidth, manualWidth, measuredW, style?.width, hasFlex, DEBUG_RESIZE]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={combinedClass}
      style={{
        width: finalWidth, // ✅ FIX: usa 'auto' se measuredW è null
        background: '#121621',
        padding: '16px 14px',
        display: 'flex',
        flexDirection: 'column',
        // ✅ CRITICO: Rimuovi flex: 1 quando c'è manualWidth, altrimenti il width fisso viene ignorato
        ...(hasFlex ? { flex: 1 } : {}),
        minHeight: 0,
        gap: 8,
        borderRight: '1px solid #252a3e',
        outline: 'none',
        position: 'relative',
        flexShrink: 0,
        ...(style || {}) // ✅ Spread style prop solo se presente (ma width viene sovrascritto da manualWidth/measuredW)
      }}
    >
      {aggregated && (
        <button
          onClick={(e) => { (onSelectAggregator ? onSelectAggregator() : undefined); (e.currentTarget as HTMLButtonElement).blur(); ref && typeof ref !== 'function' && ref.current && ref.current.focus && ref.current.focus(); }}
          style={itemStyle(safeSelectedSubIndex === undefined, false)}
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
          <span style={{ marginRight: 6 }}>{getIconComponent('Folder')}</span>
          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{rootLabel || 'Data'}</span>
        </button>
      )}
      {addingMain && (
        <div style={{ marginTop: 6 }}>
          <input
            autoFocus
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draftLabel.trim()) { onAddMain && onAddMain(draftLabel.trim()); setAddingMain(false); setDraftLabel(''); }
              if (e.key === 'Escape') { setAddingMain(false); setDraftLabel(''); }
            }}
            placeholder="New main data label…"
            style={{ width: '90%', background: '#0f172a', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 8, padding: '6px 8px', marginLeft: aggregated ? 18 : 0 }}
          />
        </div>
      )}
      {mainList.map((main, idx) => {
        const activeMain = selectedMainIndex === idx;
        const disabledMain = !isMainIncluded(idx);
        const Icon = getIconComponent(main?.icon || 'FileText');
        const subs = getSubDataList(main) || [];
        return (
          <div key={idx}>
            <button
              onClick={(e) => { onSelectMain(idx); onSelectSub && onSelectSub(undefined); (e.currentTarget as HTMLButtonElement).blur(); ref && typeof ref !== 'function' && ref.current && ref.current.focus && ref.current.focus(); }}
              style={{ ...itemStyle(activeMain, false, disabledMain), ...(aggregated ? { marginLeft: 18 } : {}) }}
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
              <span style={{ whiteSpace: 'nowrap' }}>{getLabel(main, translations)}</span>
              {(subs.length > 0) && (
                <span
                  role="button"
                  tabIndex={0}
                  title={(expandedMainIndex === idx) ? 'Collapse' : 'Expand'}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (expandedMainIndex === idx) {
                      // Accordion già espanso → collassa (chiudi)
                      setExpandedMainIndex(null);
                    } else {
                      // Accordion chiuso → espandi e seleziona
                      setExpandedMainIndex(idx);
                      onSelectMain(idx);
                      onSelectSub && onSelectSub(undefined);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      if (expandedMainIndex === idx) {
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
                  <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: `rotate(${(expandedMainIndex === idx) ? 90 : 0}deg)`, transition: 'transform 0.15s' }} aria-hidden>
                    <polyline points="2,1 8,5 2,9" fill="none" stroke={borderColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </button>
            {editingMainIdx === idx && (
              <div style={{ marginLeft: 36, marginTop: 6 }}>
                <input
                  autoFocus
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (editDraft || '').trim()) { onRenameMain && onRenameMain(idx, (editDraft || '').trim()); setEditingMainIdx(null); setEditDraft(''); }
                    if (e.key === 'Escape') { setEditingMainIdx(null); setEditDraft(''); }
                  }}
                  placeholder="Rename main…"
                  style={{ width: '80%', background: '#0f172a', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 8, padding: '6px 8px' }}
                />
              </div>
            )}
            {(expandedMainIndex === idx && subs.length > 0) && (
              <div style={{ marginLeft: 36, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {subs.map((sub: any, sidx: number) => {
                  const reqEffective = sub?.required !== false;
                  const activeSub = selectedMainIndex === idx && safeSelectedSubIndex === sidx;
                  // Grayscale when main is unchecked OR when this sub is unchecked (required=false)
                  const disabledSub = (!isMainIncluded(idx)) || (!reqEffective);
                  const SubIcon = getIconComponent(sub?.icon || 'FileText');
                  return (
                    <button
                      key={sidx}
                      draggable
                      onDragStart={(e) => {
                        dragStateRef.current = { mainIdx: idx, fromIdx: sidx };
                        try { e.dataTransfer?.setData('text/plain', String(sidx)); e.dataTransfer.dropEffect = 'move'; e.dataTransfer.effectAllowed = 'move'; } catch {}
                        try { if (localStorage.getItem('debug.sidebar')==='1') console.log('[DDT][sub.dragStart]', { main: getLabel(main, translations), from: sidx }); } catch {}
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
                            try { if (localStorage.getItem('debug.sidebar')==='1') console.log('[DDT][sub.drop]', { main: getLabel(main, translations), from: st.fromIdx, to: sidx }); } catch {}
                          }
                        }
                        dragStateRef.current = { mainIdx: null, fromIdx: null };
                        try { e.preventDefault(); } catch {}
                      }}
                      onDragEnd={() => { dragStateRef.current = { mainIdx: null, fromIdx: null }; }}
                      onClick={(e) => {
                        e.stopPropagation(); // ✅ Prevent event bubbling
                        // ✅ Select both main and sub atomically to prevent race condition
                        onSelectSub && onSelectSub(sidx, idx);
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
                      <span style={{ whiteSpace: 'nowrap' }}>{getLabel(sub, translations)}</span>
                    </button>
                  );
                })}
                {addingSubFor === idx && (
                  <div>
                    <input
                      autoFocus
                      value={draftLabel}
                      onChange={(e) => setDraftLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && draftLabel.trim()) { onAddSub && onAddSub(idx, draftLabel.trim()); setAddingSubFor(null); setDraftLabel(''); }
                        if (e.key === 'Escape') { setAddingSubFor(null); setDraftLabel(''); }
                      }}
                      placeholder="New sub-data label…"
                      style={{ width: '80%', background: '#0f172a', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 8, padding: '6px 8px' }}
                    />
                  </div>
                )}
                {editingSub && editingSub.mainIdx === idx && (
                  <div>
                    <input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (editDraft || '').trim()) { onRenameSub && onRenameSub(editingSub.mainIdx, editingSub.subIdx, (editDraft || '').trim()); setEditingSub(null); setEditDraft(''); }
                        if (e.key === 'Escape') { setEditingSub(null); setEditDraft(''); }
                      }}
                      placeholder="Rename sub…"
                      style={{ width: '80%', background: '#0f172a', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 8, padding: '6px 8px' }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {/* floating overlay */}
      {overlay && createPortal(
        <div
          onMouseEnter={() => { overlayHoverRef.current = true; if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current); }}
          onMouseLeave={() => { overlayHoverRef.current = false; maybeHideOverlay(200); }}
          style={{ position: 'fixed', top: overlay.top, left: overlay.left, transform: 'translateY(-50%)', zIndex: 9999, background: 'transparent', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {overlay.type === 'root' && (
            <button title="Add main data" style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => { setAddingMain(true); setDraftLabel(''); setOverlay(null); }}>
              <Plus size={14} color="#e5e7eb" />
            </button>
          )}
          {overlay.type === 'main' && (
            <>
              <button title="Add sub-data" style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => { if (typeof overlay.mainIdx === 'number') { setAddingSubFor(overlay.mainIdx); setDraftLabel(''); setOverlay(null); } }}>
                <Plus size={14} color="#e5e7eb" />
              </button>
              <button title="Rename" style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => { if (typeof overlay.mainIdx === 'number') { setEditingMainIdx(overlay.mainIdx); setEditDraft(getLabel(mainList[overlay.mainIdx], translations)); setOverlay(null); } }}>
                <Pencil size={14} color="#e5e7eb" />
              </button>
              <button title="Delete" style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => { if (typeof overlay.mainIdx === 'number' && onDeleteMain) { onDeleteMain(overlay.mainIdx); setOverlay(null); } }}>
                <Trash2 size={14} color="#e5e7eb" />
              </button>
            </>
          )}
          {overlay.type === 'sub' && (
            <>
              <button title="Rename sub" style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => { if (typeof overlay.mainIdx === 'number' && typeof overlay.subIdx === 'number') { setEditingSub({ mainIdx: overlay.mainIdx, subIdx: overlay.subIdx }); const sub = getSubDataList(mainList[overlay.mainIdx])[overlay.subIdx]; setEditDraft(getLabel(sub, translations)); setOverlay(null); } }}>
                <Pencil size={12} color="#e5e7eb" />
              </button>
              <button title="Delete sub" style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => { if (typeof overlay.mainIdx === 'number' && typeof overlay.subIdx === 'number' && onDeleteSub) { onDeleteSub(overlay.mainIdx, overlay.subIdx); setOverlay(null); } }}>
                <Trash2 size={12} color="#e5e7eb" />
              </button>
            </>
          )}
        </div>, document.body)}
    </div>
  );
});
export default Sidebar;

