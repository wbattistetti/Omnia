import React, { forwardRef } from 'react';
import { createPortal } from 'react-dom';
import * as ReactDOM from 'react-dom/client';
import { Check, Plus, Pencil, Trash2 } from 'lucide-react';
import { getNodeLabel, getSubNodes } from '@responseEditor/core/domain';
import getIconComponent from '@responseEditor/icons';
import styles from '@responseEditor/ResponseEditor.module.css';
import { useFontContext } from '@context/FontContext';
import { useProjectTranslations } from '@context/ProjectTranslationsContext';
import ParserStatusRow from '@responseEditor/Sidebar/ParserStatusRow';
import type { EngineType } from '@types/semanticContract';
import { getNodeIdStrict } from '@responseEditor/core/domain/nodeStrict';
import type { TaskWizardMode } from '@taskEditor/EditorHost/types';

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
  // ✅ NEW: Parser-related props
  onParserCreate?: (nodeId: string, node: any) => void;
  onParserModify?: (nodeId: string, node: any) => void;
  onEngineChipClick?: (nodeId: string, node: any, engineType: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings') => void;
  onGenerateAll?: () => void; // ✅ Pulsante globale Generate All
  // ✅ NEW: Wizard mode to conditionally render overlay
  taskWizardMode?: TaskWizardMode;
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

  const { combinedClass } = useFontContext();
  const { translations } = useProjectTranslations(); // ✅ Get translations for node labels
  const dbg = (...args: any[]) => { try { if (localStorage.getItem('debug.sidebar') === '1') console.log(...args); } catch {} };

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

  const itemStyle = (active: boolean, isSub: boolean, disabled?: boolean): React.CSSProperties => ({
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
  });

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const dragStateRef = React.useRef<{ mainIdx: number | null; fromIdx: number | null }>({ mainIdx: null, fromIdx: null });
  const forwarded = ref as any;
  React.useEffect(() => { if (forwarded) forwarded.current = containerRef.current; }, [forwarded]);
  // ✅ FIX: Calcola larghezza iniziale PRECISA in modo sincrono - deve essere identica al ghost
  // Questo elimina completamente il flash perché la larghezza è già corretta al primo render
  const calculateInitialWidth = React.useMemo(() => {
    if (!Array.isArray(mainList) || mainList.length === 0) return 280;

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

    let maxWidth = 0;

    // ✅ Calcola per tutti i main items e sub-items (IDENTICO al ghost container)
    mainList.forEach((main) => {
      const label = getNodeLabel(main, translations);
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
        const subLabel = getNodeLabel(sub, translations);
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
    const clamped = Math.min(Math.max(Math.ceil(totalWidth), 200), 640);

    return clamped;
  }, [mainList, translations, aggregated, rootLabel]);

  const [measuredW, setMeasuredW] = React.useState<number | null>(calculateInitialWidth);
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
  // ✅ FIX: Leggi manualWidth da style prop (se presente)
  const manualWidth = React.useMemo(() => {
    if (!style?.width) return null;
    const w = typeof style.width === 'number' ? style.width : parseFloat(String(style.width));
    const result = Number.isFinite(w) && w > 0 ? w : null;
    return result;
  }, [style?.width]);

  // ✅ GHOST METHOD: Ref per il container ghost
  const ghostContainerRef = React.useRef<HTMLDivElement | null>(null);
  const ghostRootRef = React.useRef<ReturnType<typeof ReactDOM.createRoot> | null>(null);

  // ✅ GHOST METHOD: useLayoutEffect per calcolare larghezza usando ghost container
  React.useLayoutEffect(() => {
    // Se c'è una larghezza manuale, NON calcolare autosize
    if (manualWidth !== null && manualWidth > 0) {
      return;
    }

    const el = containerRef.current;
    if (!el) return;
    if (!Array.isArray(mainList) || mainList.length === 0) {
      setMeasuredW(280); // Fallback
      return;
    }

    // ✅ IMPORTANTE: Mantieni la larghezza iniziale approssimativa già calcolata
    // Il ghost container la raffinera' dopo, ma almeno partiamo con una larghezza ragionevole
    // Questo evita il flash iniziale

    // ✅ Crea ghost container se non esiste
    if (!ghostContainerRef.current) {
      const ghostContainer = document.createElement('div');
      ghostContainer.style.cssText = `
        position: absolute;
        visibility: hidden;
        top: -9999px;
        left: -9999px;
        width: auto;
        height: auto;
        padding: 16px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-family: ${window.getComputedStyle(el).fontFamily};
        font-size: ${window.getComputedStyle(el).fontSize};
        white-space: nowrap;
        background: #121621;
      `;
      document.body.appendChild(ghostContainer);
      ghostContainerRef.current = ghostContainer;

      // ✅ Crea React root per il ghost container
      if (typeof ReactDOM !== 'undefined' && ReactDOM.createRoot) {
        ghostRootRef.current = ReactDOM.createRoot(ghostContainer);
      }
    }

    const ghostContainer = ghostContainerRef.current;
    if (!ghostContainer) return;

    // ✅ Renderizza ghost content con React (tutti i nodi espansi)
    const renderGhostContent = () => {
      if (!ghostRootRef.current) {
        // Se React root non disponibile, crealo
        ghostRootRef.current = ReactDOM.createRoot(ghostContainer);
      }

      // ✅ Usa React per renderizzare (più preciso, mantiene stili esatti)
      const GhostContent = () => (
        <div className={combinedClass} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {aggregated && rootLabel && (
            <button style={itemStyle(false, false)}>
              <span style={{ marginRight: 6 }}>{getIconComponent('Folder')}</span>
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{rootLabel || 'Data'}</span>
            </button>
          )}
          {mainList.map((main, idx) => {
            // ✅ NO FALLBACKS: getSubNodes always returns array (can be empty)
      const subs = getSubNodes(main);
            const hasSubs = subs.length > 0;
            const MainIcon = getIconComponent(main?.icon || 'FileText');
            return (
              <React.Fragment key={idx}>
                <button style={{ ...itemStyle(false, false), ...(aggregated ? { marginLeft: 18 } : {}) }}>
                  {aggregated && (
                    <span style={{ width: 14, height: 14, marginRight: 6, display: 'inline-block', border: '1px solid #9ca3af', borderRadius: 3 }} />
                  )}
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>{MainIcon}</span>
                  <span style={{ whiteSpace: 'nowrap' }}>{getNodeLabel(main, translations)}</span>
                  {hasSubs && (
                    <span style={{ marginLeft: 6, width: 10, height: 10, display: 'inline-block' }}>▼</span>
                  )}
                </button>
                {/* Sub items sempre renderizzati (anche se collassati nella UI reale) */}
                {subs.map((sub: any, sidx: number) => {
                  const SubIcon = getIconComponent(sub?.icon || 'FileText');
                  return (
                    <button key={sidx} style={{ ...itemStyle(false, true), marginLeft: 36 }}>
                      <span style={{ width: 14, height: 14, marginRight: 6, display: 'inline-block', border: '1px solid #9ca3af', borderRadius: 3 }} />
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{SubIcon}</span>
                      <span style={{ whiteSpace: 'nowrap' }}>{getNodeLabel(sub, translations)}</span>
                    </button>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      );

      ghostRootRef.current.render(<GhostContent />);
    };

    // ✅ Renderizza ghost content
    renderGhostContent();

    // ✅ Funzione di misurazione
    const measure = () => {
      if (!ghostContainerRef.current) {
        return;
      }

      // ✅ Trova l'elemento più largo (cerca ricorsivamente tutti i button)
      const findAllButtons = (element: HTMLElement): HTMLElement[] => {
        const buttons: HTMLElement[] = [];
        if (element.tagName === 'BUTTON') {
          buttons.push(element);
        }
        for (let i = 0; i < element.children.length; i++) {
          buttons.push(...findAllButtons(element.children[i] as HTMLElement));
        }
        return buttons;
      };

      const allButtons = findAllButtons(ghostContainerRef.current);

      if (allButtons.length === 0) {
        // Riprova dopo un breve delay
        setTimeout(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(measure);
          });
        }, 50);
        return;
      }

      let maxWidth = 0;

      for (const button of allButtons) {
        const rect = button.getBoundingClientRect();
        if (rect.width > 0 && rect.width > maxWidth) {
          maxWidth = rect.width;
        }
      }

      // ✅ Se non trovato, prova a misurare il container stesso
      if (maxWidth === 0) {
        const containerRect = ghostContainerRef.current.getBoundingClientRect();
        if (containerRect.width > 0) {
          maxWidth = containerRect.width;
        } else {
          setMeasuredW(280); // Fallback
          return;
        }
      }

      // ✅ IMPORTANTE: maxWidth è la larghezza del button (che include il suo padding interno)
      // Dobbiamo aggiungere solo:
      // - padding del container (14px left + 14px right)
      // - gutter per sicurezza
      // - padding extra configurabile
      const containerPadding = 14 + 14; // paddingLeft + paddingRight del container
      const GUTTER = 10; // Spazio extra per sicurezza
      const EXTRA_PADDING = 10; // ✅ PADDING EXTRA CONFIGURABILE (ridotto per precisione)

      const totalWidth = maxWidth + containerPadding + GUTTER + EXTRA_PADDING;
      const clamped = Math.min(Math.max(Math.ceil(totalWidth), 200), 640);

      // ✅ LOGICA: Il calcolo iniziale è già preciso, quindi NON aggiornare se la differenza è minima
      // Questo elimina completamente il flash perché la larghezza è già corretta
      const currentWidth = measuredW || calculateInitialWidth;
      const difference = Math.abs(clamped - currentWidth);

      // ✅ Aggiorna SOLO se la differenza è significativa (> 3px)
      // Se il calcolo iniziale è corretto (differenza < 3px), NON aggiornare = ZERO flash
      if (difference > 3) {
        setMeasuredW(clamped);
      } else {
        // ✅ Calcolo iniziale era già corretto, nessun aggiornamento necessario
        // Questo elimina il flash perché non c'è cambio di stato
      }

      // ✅ Calcolo completato (log rimosso per pulizia console)
    };

    // ✅ Usa MutationObserver per aspettare che React abbia renderizzato
    let observer: MutationObserver | null = null;
    let measureTimeout: number | null = null;

    const startMeasurement = () => {
      // ✅ Pulisci timeout precedente
      if (measureTimeout) {
        clearTimeout(measureTimeout);
      }

      // ✅ Verifica se ci sono elementi
      if (ghostContainerRef.current && ghostContainerRef.current.children.length > 0) {
        // ✅ Disconnetti observer se presente
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        // ✅ Misura dopo che il layout è completo
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(measure, 10);
          });
        });
      } else {
        // ✅ Aspetta che gli elementi vengano aggiunti
        if (!observer && ghostContainerRef.current) {
          observer = new MutationObserver(() => {
            if (ghostContainerRef.current && ghostContainerRef.current.children.length > 0) {
              observer?.disconnect();
              observer = null;
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  setTimeout(measure, 10);
                });
              });
            }
          });
          observer.observe(ghostContainerRef.current, {
            childList: true,
            subtree: true
          });
        }
      }
    };

    // ✅ Avvia la misurazione
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        startMeasurement();
        // ✅ Fallback: misura dopo 100ms anche se MutationObserver non ha funzionato
        measureTimeout = window.setTimeout(() => {
          if (ghostContainerRef.current && ghostContainerRef.current.children.length > 0) {
            measure();
          }
        }, 100);
      });
    });

    // ✅ Cleanup
    return () => {
      if (observer) {
        observer.disconnect();
      }
      if (measureTimeout) {
        clearTimeout(measureTimeout);
      }
    };
  }, [mainList, aggregated, rootLabel, translations, manualWidth, combinedClass, bgBase, textBase, borderColor, itemStyle]);

  // ✅ Cleanup: rimuovi ghost container quando il componente si smonta
  React.useEffect(() => {
    return () => {
      if (ghostRootRef.current) {
        try {
          // ✅ Use setTimeout to avoid unmounting during render
          setTimeout(() => {
            if (ghostRootRef.current) {
              ghostRootRef.current.unmount();
              ghostRootRef.current = null;
            }
          }, 0);
        } catch {}
      }
      if (ghostContainerRef.current) {
        try {
          // ✅ Use setTimeout to avoid removing DOM during render
          setTimeout(() => {
            if (ghostContainerRef.current && document.body.contains(ghostContainerRef.current)) {
              document.body.removeChild(ghostContainerRef.current);
              ghostContainerRef.current = null;
            }
          }, 0);
        } catch {}
      }
    };
  }, []);

  // ✅ DEBUG: Log quando finalWidth cambia
  // ✅ IMPORTANTE: Se measuredW è null, usa un fallback invece di 'auto' per evitare sidebar troppo larga
  const finalWidth = manualWidth ?? measuredW ?? 280; // Fallback a 280 invece di 'auto'
  const hasFlex = !manualWidth && measuredW === null; // ✅ CRITICO: Solo flex se non c'è manualWidth E measuredW è null

      // ✅ Early return check moved here (after all hooks) to comply with React Hooks rules
      if (!Array.isArray(mainList) || mainList.length === 0) {
        return null;
      }

  return (
    <div
      ref={containerRef}
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
        borderRight: '1px solid #252a3e',
        outline: 'none',
        position: 'relative',
        flexShrink: 0,
        // ✅ IMPORTANTE: Spread style prop DOPO, ma escludi width per evitare sovrascritture
        ...(style ? Object.fromEntries(Object.entries(style).filter(([key]) => key !== 'width')) : {})
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
        // ✅ NO FALLBACKS: getSubNodes always returns array (can be empty)
      const subs = getSubNodes(main);
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
              <span style={{ whiteSpace: 'nowrap', flex: 1 }}>{getNodeLabel(main, translations)}</span>
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
                    <React.Fragment key={sidx}>
                      <button
                        draggable
                        onDragStart={(e) => {
                          dragStateRef.current = { mainIdx: idx, fromIdx: sidx };
                          try { e.dataTransfer?.setData('text/plain', String(sidx)); e.dataTransfer.dropEffect = 'move'; e.dataTransfer.effectAllowed = 'move'; } catch {}
                          try { if (localStorage.getItem('debug.sidebar')==='1') console.log('[DDT][sub.dragStart]', { main: getNodeLabel(main, translations), from: sidx }); } catch {}
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
                              try { if (localStorage.getItem('debug.sidebar')==='1') console.log('[DDT][sub.drop]', { main: getNodeLabel(main, translations), from: st.fromIdx, to: sidx }); } catch {}
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
                        <span style={{ whiteSpace: 'nowrap', flex: 1 }}>{getNodeLabel(sub, translations)}</span>
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
      {/* ✅ Global Generate All button */}
      {onGenerateAll && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${borderColor}` }}>
          <button
            onClick={onGenerateAll}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 600,
              background: 'rgba(96, 165, 250, 0.2)',
              border: '1px solid rgba(96, 165, 250, 0.5)',
              color: '#60a5fa',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <Plus size={14} />
            Genera automaticamente i parser mancanti
          </button>
        </div>
      )}
      {/* ✅ FIX: floating overlay - render ONLY when taskWizardMode === 'none' */}
      {/* ✅ CRITICAL: Overlay must be completely unmounted when taskWizardMode !== 'none' */}
      {/* ✅ This prevents overlay from covering the wizard in full mode */}
      {overlay && (taskWizardMode === 'none' || taskWizardMode === undefined) && createPortal(
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
              <button title="Rename" style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => { if (typeof overlay.mainIdx === 'number') { setEditingMainIdx(overlay.mainIdx); setEditDraft(getNodeLabel(mainList[overlay.mainIdx], translations)); setOverlay(null); } }}>
                <Pencil size={14} color="#e5e7eb" />
              </button>
              <button title="Delete" style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => { if (typeof overlay.mainIdx === 'number' && onDeleteMain) { onDeleteMain(overlay.mainIdx); setOverlay(null); } }}>
                <Trash2 size={14} color="#e5e7eb" />
              </button>
            </>
          )}
          {overlay.type === 'sub' && (
            <>
              <button title="Rename sub" style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => { if (typeof overlay.mainIdx === 'number' && typeof overlay.subIdx === 'number') { setEditingSub({ mainIdx: overlay.mainIdx, subIdx: overlay.subIdx }); const sub = getSubNodes(mainList[overlay.mainIdx])[overlay.subIdx]; setEditDraft(getNodeLabel(sub, translations)); setOverlay(null); } }}>
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
}

const Sidebar = forwardRef<HTMLDivElement, SidebarProps>(SidebarComponent);
export default Sidebar;

