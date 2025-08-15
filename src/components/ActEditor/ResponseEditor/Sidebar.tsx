import React, { forwardRef } from 'react';
import { BookOpen, X as CloseIcon } from 'lucide-react';
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

  const itemStyle = (active: boolean, isSub: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    background: active ? bgActive : bgBase,
    color: textBase,
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

  return (
    <div
      ref={ref}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ width: 220, background: '#121621', padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 8, borderRight: '1px solid #252a3e', outline: 'none' }}
    >
      {/* Aggregated group header */}
      {aggregated && (
        <button
          onClick={(e) => { (onSelectAggregator ? onSelectAggregator() : undefined); (e.currentTarget as HTMLButtonElement).blur(); ref && typeof ref !== 'function' && ref.current && ref.current.focus && ref.current.focus(); }}
          style={itemStyle(safeSelectedSubIndex === undefined, false)}
          className={safeSelectedSubIndex === undefined ? styles.sidebarSelected : ''}
        >
          <span style={{ marginRight: 6 }}>{getIconComponent('Folder')}</span>
          <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{rootLabel || 'Data'}</span>
        </button>
      )}
      {mainList.map((main, idx) => {
        const activeMain = selectedMainIndex === idx && safeSelectedSubIndex === undefined;
        const Icon = getIconComponent(main?.icon || 'FileText');
        const subs = getSubDataList(main) || [];
        return (
          <div key={idx}>
            <button
              onClick={(e) => { onSelectMain(idx); onSelectSub && onSelectSub(undefined); (e.currentTarget as HTMLButtonElement).blur(); ref && typeof ref !== 'function' && ref.current && ref.current.focus && ref.current.focus(); }}
              style={itemStyle(activeMain, false)}
              className={activeMain ? styles.sidebarSelected : ''}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>{Icon}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{getLabel(main)}</span>
              <button
                title={showSynonyms && activeMain ? 'Chiudi profilo NLP' : 'Apri profilo NLP'}
                onClick={(e) => { e.stopPropagation(); onToggleSynonyms && onToggleSynonyms(idx, undefined); }}
                style={{ border: '1px solid rgba(229,231,235,0.5)', background: (showSynonyms && activeMain) ? '#ffffff' : 'transparent', color: (showSynonyms && activeMain) ? '#0b1220' : '#e5e7eb', borderRadius: 8, padding: '4px 6px', display: 'inline-flex', alignItems: 'center' }}
              >{(showSynonyms && activeMain) ? <CloseIcon size={14} /> : <BookOpen size={14} />}</button>
            </button>
            {(selectedMainIndex === idx && subs.length > 0) && (
              <div style={{ marginLeft: 18, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {subs.map((sub: any, sidx: number) => {
                  const activeSub = selectedMainIndex === idx && safeSelectedSubIndex === sidx;
                  const SubIcon = getIconComponent(sub?.icon || 'FileText');
                  return (
                    <button
                      key={sidx}
                      onClick={(e) => { onSelectSub && onSelectSub(sidx); (e.currentTarget as HTMLButtonElement).blur(); ref && typeof ref !== 'function' && ref.current && ref.current.focus && ref.current.focus(); }}
                      style={itemStyle(activeSub, true)}
                      className={activeSub ? styles.sidebarSelected : ''}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{SubIcon}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{getLabel(sub)}</span>
                      <button
                        title={showSynonyms && activeSub ? 'Chiudi profilo NLP' : 'Apri profilo NLP'}
                        onClick={(e) => { e.stopPropagation(); onToggleSynonyms && onToggleSynonyms(idx, sidx); }}
                        style={{ border: '1px solid rgba(229,231,235,0.5)', background: (showSynonyms && activeSub) ? '#ffffff' : 'transparent', color: (showSynonyms && activeSub) ? '#0b1220' : '#e5e7eb', borderRadius: 8, padding: '4px 6px', display: 'inline-flex', alignItems: 'center' }}
                      >{(showSynonyms && activeSub) ? <CloseIcon size={14} /> : <BookOpen size={14} />}</button>
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

