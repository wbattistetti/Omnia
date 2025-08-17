import React, { forwardRef } from 'react';
import { BookOpen, X as CloseIcon, Check } from 'lucide-react';
import { getLabel, getSubDataList } from './ddtSelectors';
import getIconComponent from './icons';
import styles from './ResponseEditor.module.css';

interface SidebarProps {
  mainList: any[];
  selectedMainIndex: number;
  onSelectMain: (idx: number) => void;
  selectedSubIndex?: number | null;
  onSelectSub?: (idx: number | undefined) => void;
  aggregated?: boolean;
  rootLabel?: string;
  onSelectAggregator?: () => void;
  onToggleSynonyms?: (mainIdx: number, subIdx?: number) => void;
  showSynonyms?: boolean;
}

const Sidebar = forwardRef<HTMLDivElement, SidebarProps>(function Sidebar({ mainList, selectedMainIndex, onSelectMain, selectedSubIndex, onSelectSub, aggregated, rootLabel = 'Data', onSelectAggregator, onToggleSynonyms, showSynonyms }, ref) {
  if (!Array.isArray(mainList) || mainList.length === 0) return null;
  // Pastel/silver palette
  const borderColor = 'rgba(156,163,175,0.65)';
  const bgBase = 'rgba(156,163,175,0.10)';
  const bgActive = 'rgba(156,163,175,0.40)';
  const textBase = '#e5e7eb';

  // Include state for mains and subs (UI-only). Default: included (true)
  const [includedMains, setIncludedMains] = React.useState<Record<number, boolean>>({});
  const [includedSubs, setIncludedSubs] = React.useState<Record<string, boolean>>({});

  const isMainIncluded = (idx: number) => includedMains[idx] !== false;
  const isSubIncluded = (mIdx: number, sIdx: number) => includedSubs[`${mIdx}:${sIdx}`] !== false;
  const toggleMainInclude = (idx: number, v: boolean) => setIncludedMains(prev => ({ ...prev, [idx]: v }));
  const toggleSubInclude = (mIdx: number, sIdx: number, v: boolean) => setIncludedSubs(prev => ({ ...prev, [`${mIdx}:${sIdx}`]: v }));

  // selectedSubIndex: undefined o number
  const safeSelectedSubIndex = typeof selectedSubIndex === 'number' && !isNaN(selectedSubIndex) ? selectedSubIndex : undefined;

  // Navigazione tastiera naturale tra main e subdata
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let handled = false;
    // Costruisci la lista piatta degli item: [{type: 'main', idx}, {type: 'sub', mainIdx, subIdx}, ...]
    const flatList: Array<{ type: 'main' | 'sub'; mainIdx: number; subIdx?: number }> = [];
    mainList.forEach((main, mIdx) => {
      flatList.push({ type: 'main', mainIdx: mIdx });
      const subs = getSubDataList(main) || [];
      subs.forEach((_, sIdx) => {
        flatList.push({ type: 'sub', mainIdx: mIdx, subIdx: sIdx });
      });
    });
    // Trova la posizione corrente
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
          onSelectMain(next.mainIdx);
          onSelectSub && onSelectSub(next.subIdx!);
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
          onSelectMain(prev.mainIdx);
          onSelectSub && onSelectSub(prev.subIdx!);
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
    fontSize: isSub ? 13 : 14,
    textAlign: 'left' as const,
    outline: 'none',
    outlineOffset: 0,
    boxShadow: 'none',
    fontWeight: active ? 700 : 400,
    transition: 'border 0.15s',
  });

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const forwarded = ref as any;
  React.useEffect(() => { if (forwarded) forwarded.current = containerRef.current; }, [forwarded]);
  const [measuredW, setMeasuredW] = React.useState<number>(280);
  React.useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const items = Array.from(el.querySelectorAll('.sb-item')) as HTMLElement[];
      let maxWidth = 0;
      for (const it of items) {
        const w = it.scrollWidth;
        if (w > maxWidth) maxWidth = w;
      }
      // Add a right-side gutter so the vertical border sits ~10px away from the rightmost node
      const gutter = 45; // 35 + 10 extra pixels
      const width = Math.ceil(maxWidth) + gutter;
      const clamped = Math.min(Math.max(width, 200), 640);
      setMeasuredW(clamped);
    };
    // measure after paint
    const id = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', measure); };
  }, [mainList]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ width: measuredW, background: '#121621', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 8, borderRight: '1px solid #252a3e', outline: 'none' }}
    >
      {/* Aggregated group header */}
      {aggregated && (
        <button
          onClick={(e) => { (onSelectAggregator ? onSelectAggregator() : undefined); (e.currentTarget as HTMLButtonElement).blur(); ref && typeof ref !== 'function' && ref.current && ref.current.focus && ref.current.focus(); }}
          style={itemStyle(safeSelectedSubIndex === undefined, false)}
          className={`sb-item ${safeSelectedSubIndex === undefined ? styles.sidebarSelected : ''}`}
        >
          <span style={{ marginRight: 6 }}>{getIconComponent('Folder')}</span>
          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{rootLabel || 'Data'}</span>
        </button>
      )}
      {mainList.map((main, idx) => {
        const activeMain = selectedMainIndex === idx && safeSelectedSubIndex === undefined;
        const disabledMain = !isMainIncluded(idx);
        const Icon = getIconComponent(main?.icon || 'FileText');
        const subs = getSubDataList(main) || [];
        return (
          <div key={idx}>
            <button
              onClick={(e) => { onSelectMain(idx); onSelectSub && onSelectSub(undefined); (e.currentTarget as HTMLButtonElement).blur(); ref && typeof ref !== 'function' && ref.current && ref.current.focus && ref.current.focus(); }}
              style={{ ...itemStyle(activeMain, false, disabledMain), ...(aggregated ? { marginLeft: 18 } : {}) }}
              className={`sb-item ${activeMain ? styles.sidebarSelected : ''}`}
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
              <span style={{ whiteSpace: 'nowrap' }}>{getLabel(main)}</span>
              <span
                role="button"
                tabIndex={0}
                title={showSynonyms && activeMain ? 'Chiudi profilo NLP' : 'Apri profilo NLP'}
                onClick={(e) => { e.stopPropagation(); onToggleSynonyms && onToggleSynonyms(idx, undefined); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleSynonyms && onToggleSynonyms(idx, undefined); } }}
                style={{ border: '1px solid rgba(229,231,235,0.5)', background: (showSynonyms && activeMain) ? '#ffffff' : 'transparent', color: (showSynonyms && activeMain) ? '#0b1220' : '#e5e7eb', borderRadius: 8, padding: '4px 6px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
              >{(showSynonyms && activeMain) ? <CloseIcon size={14} /> : <BookOpen size={14} />}</span>
            </button>
            {(selectedMainIndex === idx && subs.length > 0) && (
              <div style={{ marginLeft: 36, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {subs.map((sub: any, sidx: number) => {
                  const activeSub = selectedMainIndex === idx && safeSelectedSubIndex === sidx;
                  const disabledSub = disabledMain || !isSubIncluded(idx, sidx);
                  const SubIcon = getIconComponent(sub?.icon || 'FileText');
                  return (
                    <button
                      key={sidx}
                      onClick={(e) => { onSelectSub && onSelectSub(sidx); (e.currentTarget as HTMLButtonElement).blur(); ref && typeof ref !== 'function' && ref.current && ref.current.focus && ref.current.focus(); }}
                      style={itemStyle(activeSub, true, disabledSub)}
                      className={`sb-item ${activeSub ? styles.sidebarSelected : ''}`}
                    >
                      <span
                        role="checkbox"
                        aria-checked={isSubIncluded(idx, sidx)}
                        title="Include sub data"
                        onClick={(e) => { e.stopPropagation(); toggleSubInclude(idx, sidx, !isSubIncluded(idx, sidx)); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSubInclude(idx, sidx, !isSubIncluded(idx, sidx)); } }}
                        style={{ display: 'inline-flex', alignItems: 'center', marginRight: 6, cursor: 'pointer' }}
                        tabIndex={0}
                      >
                        {disabledMain ? (
                          <Check size={14} color="#9ca3af" />
                        ) : isSubIncluded(idx, sidx) ? (
                          <Check size={14} color="#e5e7eb" />
                        ) : (
                          <span style={{ width: 14, height: 14, display: 'inline-block', border: '1px solid #9ca3af', borderRadius: 3 }} />
                        )}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{SubIcon}</span>
                      <span style={{ whiteSpace: 'nowrap' }}>{getLabel(sub)}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        title={showSynonyms && activeSub ? 'Chiudi profilo NLP' : 'Apri profilo NLP'}
                        onClick={(e) => { e.stopPropagation(); onToggleSynonyms && onToggleSynonyms(idx, sidx); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleSynonyms && onToggleSynonyms(idx, sidx); } }}
                        style={{ border: '1px solid rgba(229,231,235,0.5)', background: (showSynonyms && activeSub) ? '#ffffff' : 'transparent', color: (showSynonyms && activeSub) ? '#0b1220' : '#e5e7eb', borderRadius: 8, padding: '4px 6px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                      >{(showSynonyms && activeSub) ? <CloseIcon size={14} /> : <BookOpen size={14} />}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
export default Sidebar;

