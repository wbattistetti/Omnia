import React from 'react';
import { getDDTIcon as getDDTIconFromRE } from '../ActEditor/ResponseEditor/ddtUtils';
import { X, Pencil, Check } from 'lucide-react';
import { SIDEBAR_ICON_COMPONENTS, SIDEBAR_TYPE_ICONS } from '../Sidebar/sidebarTheme';

type VarsMap = Record<string, any>;

type VarsTreeSub = { label: string; kind?: string };
type VarsTreeMain = { label: string; kind?: string; subs: VarsTreeSub[] };
type VarsTreeAct = { label: string; color?: string; Icon?: any; mains: VarsTreeMain[] };

interface Props {
  open: boolean;
  onClose: () => void;
  variables: VarsMap; // full variables map; shown as list
  onSave?: (script: string) => void;
  initialScript?: string;
  dockWithinParent?: boolean;
  variablesTree?: VarsTreeAct[];
  label?: string;
  onRename?: (next: string) => void;
}

const listKeys = (vars: VarsMap): string[] => {
  try { return Object.keys(vars || {}).sort(); } catch { return []; }
};

export default function ConditionEditor({ open, onClose, variables, onSave, initialScript, dockWithinParent, variablesTree, label, onRename }: Props) {
  const [nl, setNl] = React.useState('');
  const [script, setScript] = React.useState(initialScript || 'return true;');
  const [result, setResult] = React.useState<string>('');
  const [busy, setBusy] = React.useState(false);
  const varsKeys = React.useMemo(() => listKeys(variables), [variables]);
  const [filter] = React.useState('');
  const nlRef = React.useRef<HTMLTextAreaElement>(null); // legacy, not used anymore
  const nlCERef = React.useRef<HTMLDivElement>(null);
  const scriptRef = React.useRef<HTMLTextAreaElement>(null);
  const [nlHeight] = React.useState<number>(40);
  const nlCaretRef = React.useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const scriptCaretRef = React.useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const [isEditingTitle, setIsEditingTitle] = React.useState<boolean>(false);
  const [titleValue, setTitleValue] = React.useState<string>(label || 'Condition');
  React.useEffect(() => { setTitleValue(label || 'Condition'); }, [label]);
  const [headerHover, setHeaderHover] = React.useState<boolean>(false);

  // Ensure caret never stays inside a token; snap to the token's right boundary
  const snapCaretOutsideTokens = React.useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    const text = nl || '';
    const s = el.selectionStart ?? 0;
    const ranges: Array<{ start: number; end: number }> = [];
    try {
      const re = /\{[^}]+\}/g; let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const start = m.index;
        const end = m.index + m[0].length; // index right after the closing brace
        ranges.push({ start, end });
      }
    } catch {}
    const inside = (pos: number) => ranges.find(r => pos > r.start && pos < r.end);
    const atOpen = (pos: number) => ranges.find(r => pos === r.start);
    const atClose = (pos: number) => ranges.find(r => pos === r.end);
    // If inside token or exactly on '{', snap to nearest boundary (r.start or r.end)
    const tok = inside(s) || atOpen(s);
    if (tok) {
      const mid = tok.start + Math.floor((tok.end - tok.start) / 2);
      const target = s < mid ? tok.start : tok.end; // left half -> start, right half -> end
      try { el.setSelectionRange(target, target); } catch {}
      nlCaretRef.current = { start: target, end: target };
      return;
    }
    // If click lands exactly on '}' → move one char to the right
    const tokClose = atClose(s);
    if (tokClose) { try { el.setSelectionRange(tokClose.end, tokClose.end); } catch {} nlCaretRef.current = { start: tokClose.end, end: tokClose.end }; }
  }, [nl]);

  const scheduleSnap = React.useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    try {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          snapCaretOutsideTokens(el);
        });
      });
    } catch {
      setTimeout(() => snapCaretOutsideTokens(el), 0);
    }
  }, [snapCaretOutsideTokens]);

  // Simple variables intellisense state
  const [showVarsMenu, setShowVarsMenu] = React.useState(false);
  const [varsMenuFilter, setVarsMenuFilter] = React.useState('');
  const [varsMenuActiveField, setVarsMenuActiveField] = React.useState<'nl' | 'script' | null>(null);
  const [varsMenuAnchor, setVarsMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [varsMenuPos, setVarsMenuPos] = React.useState<{ left: number; top: number } | null>(null);
  const [varsMenuMaxH, setVarsMenuMaxH] = React.useState<number>(280);
  const varsMenuRef = React.useRef<HTMLDivElement>(null);
  const [varsMenuHover, setVarsMenuHover] = React.useState<boolean>(false);
  const [varsNavIndex, setVarsNavIndex] = React.useState<number>(0);
  const [expandedActs, setExpandedActs] = React.useState<Record<string, boolean>>({});
  const [expandedMains, setExpandedMains] = React.useState<Record<string, boolean>>({});
  const filteredVarsForMenu = React.useMemo(() => {
    const f = (varsMenuFilter || '').trim().toLowerCase();
    if (!f) return varsKeys;
    return varsKeys.filter(k => k.toLowerCase().includes(f));
  }, [varsKeys, varsMenuFilter]);
  // const flatTreeTokens = React.useMemo(() => [], [variablesTree]);
  const filteredTreeActs = React.useMemo(() => {
    const q = (varsMenuFilter || '').trim().toLowerCase();
    if (!q) return variablesTree || [];
    const match = (label?: string) => String(label || '').toLowerCase().includes(q);
    const res: VarsTreeAct[] = [];
    (variablesTree || []).forEach(act => {
      const mains: VarsTreeMain[] = [];
      (act.mains || []).forEach(m => {
        const subs: VarsTreeSub[] = [];
        (m.subs || []).forEach(s => { if (match(`${act.label}.${m.label}.${s.label}`) || match(s.label)) subs.push(s); });
        if (subs.length || match(`${act.label}.${m.label}`) || match(m.label)) mains.push({ ...m, subs });
      });
      if (mains.length || match(act.label)) res.push({ ...act, mains });
    });
    return res;
  }, [variablesTree, varsMenuFilter]);

  // Navigation entries (include act rows so Enter toggles expansion)
  type NavEntry = { key: string; kind: 'act' | 'main' | 'sub' | 'token'; token?: string; act?: string; main?: string; sub?: string };
  const { navEntries, navIndexByKey } = React.useMemo(() => {
    const entries: NavEntry[] = [];
    const indexByKey = new Map<string, number>();
    if (variablesTree && (variablesTree.length > 0)) {
      (filteredTreeActs || []).forEach(act => {
        // Act row always visible
        entries.push({ key: `ACT::${act.label}`, kind: 'act', act: act.label });
        indexByKey.set(`ACT::${act.label}`, entries.length - 1);
        // Visible mains only when act expanded
        if (expandedActs[act.label]) {
          (act.mains || []).forEach(m => {
            entries.push({ key: `${act.label}.${m.label}`, kind: 'main', token: `${act.label}.${m.label}`, act: act.label, main: m.label });
            indexByKey.set(`${act.label}.${m.label}`, entries.length - 1);
            // Visible subs only when main expanded
            if (expandedMains[`${act.label}::${m.label}`]) {
              (m.subs || []).forEach(s => {
                const k = `${act.label}.${m.label}.${s.label}`;
                entries.push({ key: k, kind: 'sub', token: k, act: act.label, main: m.label, sub: s.label });
                indexByKey.set(k, entries.length - 1);
              });
            }
          });
        }
      });
    } else {
      filteredVarsForMenu.forEach(k => { entries.push({ key: k, kind: 'token', token: k }); indexByKey.set(k, entries.length - 1); });
    }
    return { navEntries: entries, navIndexByKey: indexByKey };
  }, [variablesTree, filteredTreeActs, filteredVarsForMenu, expandedActs, expandedMains]);

  const navigateIntellisense = React.useCallback((key: 'ArrowUp' | 'ArrowDown' | 'Enter') => {
    const len = navEntries.length;
    if (len === 0) return;
    if (key === 'Enter') {
      const entry = navEntries[Math.max(0, Math.min(varsNavIndex, len - 1))];
      if (!entry) return;
      if (entry.kind === 'act' && entry.act) {
        setExpandedActs(prev => ({ ...prev, [entry.act!]: !prev[entry.act!] }));
      } else if (entry.token) {
        insertVariableToken(entry.token);
        try { console.log('[ConditionEditor][Intellisense][enter]', { index: varsNavIndex, token: entry.token }); } catch {}
      }
      return;
    }
    setVarsNavIndex(prev => {
      const next = key === 'ArrowDown' ? (prev + 1) % len : (prev - 1 + len) % len;
      setTimeout(() => {
        const el = varsMenuRef.current?.querySelector(`[data-nav-index="${next}"]`) as HTMLElement | null;
        if (el) el.scrollIntoView({ block: 'nearest' });
      }, 0);
      try { console.log('[ConditionEditor][Intellisense][move]', { key, prev, next, len }); } catch {}
      return next;
    });
  }, [varsNavIndex, navEntries]);

  // Move selection with Up/Down and commit with Enter even if focus stays in textarea
  React.useEffect(() => {
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
        if (navEntries.length > 0) { e.preventDefault(); navigateIntellisense('Enter'); }
      } else if (key === 'Escape') {
        e.preventDefault();
        setShowVarsMenu(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showVarsMenu, navEntries, varsNavIndex, navigateIntellisense]);

  // While hovering the menu, Up/Down arrows scroll the list
  React.useEffect(() => {
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

  React.useEffect(() => { setScript(initialScript || 'return true;'); }, [initialScript]);

  const filteredKeys = React.useMemo(() => {
    const f = (filter || '').trim().toLowerCase();
    if (!f) return varsKeys;
    return varsKeys.filter(k => k.toLowerCase().includes(f));
  }, [varsKeys, filter]);

  

  if (!open) return null;

  const containerStyle: React.CSSProperties = dockWithinParent
    ? { position: 'absolute', left: 0, right: 0, bottom: 0, height: 320 }
    : { position: 'fixed', left: 0, right: 0, bottom: 0, height: 320 };

  const generate = async () => {
    if (!nl.trim()) return;
    setBusy(true);
    try {
      // naive local generation placeholder; wire to backend AI later
      const firstKey = varsKeys[0] || 'x';
      let gen = 'try {\n';
      if (/not\s+empty|exists/i.test(nl)) gen += `  return Boolean(vars["${firstKey}"]);\n`;
      else if (/equals?/i.test(nl)) gen += `  return vars["${firstKey}"] === /* TODO value */ '';\n`;
      else gen += '  return true;\n';
      gen += '} catch { return false; }';
      setScript(gen);
    } finally {
      setBusy(false);
    }
  };

  const test = () => {
    try {
      // Sandbox: expose variables as a single object "vars"
      // eslint-disable-next-line no-new-func
      const fn = new Function('vars', script);
      const out = fn(variables || {});
      setResult(String(Boolean(out)));
    } catch (e: any) {
      setResult('Error: ' + (e?.message || 'invalid script'));
    }
  };

  // Insert selected variable token at the caret for the active field
  const insertVariableToken = (varKey: string) => {
    const target = varsMenuActiveField === 'nl' ? (nlCERef.current as any) : scriptRef.current;
    if (!target) return;

    const isScript = varsMenuActiveField === 'script';
    const token = isScript ? `vars["${varKey}"]` : `{${varKey}}`;

    if (varsMenuActiveField === 'nl') {
      // Insert a non-editable chip into contenteditable; use execCommand so undo/redo works
      try {
        (target as HTMLElement).focus();
        const html = `<span data-token="1" contenteditable="false" style="padding:2px 6px;border-radius:6px;border:1px solid #38bdf8;background:rgba(56,189,248,0.15);color:#e5e7eb;font-weight:700;">${token}</span>&nbsp;`;
        // eslint-disable-next-line deprecation/deprecation
        document.execCommand('insertHTML', false, html);
        setNl(serializeCE());
      } catch {}
    } else if (varsMenuActiveField === 'script') {
      const current = script;
      const caretStart = (scriptCaretRef.current?.start ?? (current.length));
      const caretEnd = (scriptCaretRef.current?.end ?? caretStart);
      const next = current.slice(0, caretStart) + token + current.slice(caretEnd);
      setScript(next);
      setTimeout(() => {
        try {
          target.focus();
          const pos = caretStart + token.length;
          (target as any).setSelectionRange(pos, pos);
          scriptCaretRef.current = { start: pos, end: pos };
        } catch {}
      }, 0);
    }

    setShowVarsMenu(false);
  };

  const openVarsMenuFor = (field: 'nl' | 'script', anchorEl: HTMLElement | null) => {
    setVarsMenuActiveField(field);
    setVarsMenuAnchor(anchorEl);
    setVarsMenuFilter('');
    setShowVarsMenu(true);
    // Compute caret-based floating position
    const ta = field === 'nl' ? (null as any) : (scriptRef.current as HTMLTextAreaElement | null);
    const computeCaretViewportPosTextarea = (textarea: HTMLTextAreaElement | null): { left: number; top: number, caretRect?: DOMRect } | null => {
      if (!textarea) return null;
      try {
        const style = window.getComputedStyle(textarea);
        const div = document.createElement('div');
        div.style.position = 'fixed';
        div.style.visibility = 'hidden';
        div.style.whiteSpace = 'pre-wrap';
        div.style.wordWrap = 'break-word';
        div.style.font = style.font;
        div.style.padding = style.padding;
        div.style.border = style.border;
        div.style.letterSpacing = style.letterSpacing as string;
        div.style.width = textarea.clientWidth + 'px';
        const value = textarea.value;
        const caretIndex = textarea.selectionStart || 0;
        const before = value.substring(0, caretIndex).replace(/\n/g, '\n');
        const textNode = document.createTextNode(before);
        const marker = document.createElement('span');
        marker.textContent = '\u200b';
        div.appendChild(textNode);
        div.appendChild(marker);
        document.body.appendChild(div);
        const taRect = textarea.getBoundingClientRect();
        // Horizontal align to caret (approx), vertical anchored to caret baseline
        const rect = marker.getBoundingClientRect();
        const approxLeftWithin = Math.min(rect.left - div.getBoundingClientRect().left, textarea.clientWidth - 4);
        const left = taRect.left + approxLeftWithin;
        const top = rect.bottom + 6;
        document.body.removeChild(div);
        return { left, top, caretRect: rect };
      } catch {
        return null;
      }
    };
    const computeCaretViewportPosCE = (root: HTMLElement | null): { left: number; top: number, caretRect?: DOMRect } | null => {
      if (!root) return null;
      try {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;
        const r = sel.getRangeAt(0).cloneRange();
        r.collapse(true);
        let rect = r.getBoundingClientRect();
        if (!rect || rect.height === 0) {
          const marker = document.createElement('span');
          marker.textContent = '\u200b';
          r.insertNode(marker);
          rect = marker.getBoundingClientRect();
          marker.parentNode && marker.parentNode.removeChild(marker);
        }
        return { left: rect.left, top: rect.bottom + 6, caretRect: rect };
      } catch { return null; }
    };
    const caretPos = field === 'nl' ? computeCaretViewportPosCE(nlCERef.current as any) : computeCaretViewportPosTextarea(ta);
    if (caretPos) {
      const menuW = 360;
      const margin = 10;
      let left = caretPos.left;
      const rect = caretPos.caretRect as DOMRect;
      const availableBelow = window.innerHeight - (rect ? rect.bottom + 6 : caretPos.top) - margin;
      const availableAbove = (rect ? rect.top : caretPos.top) - margin;
      // Decide placement and max height
      let top = caretPos.top;
      let maxH = 280;
      if (availableBelow >= 180) {
        maxH = Math.min(280, availableBelow);
        top = (rect ? rect.bottom + 6 : caretPos.top);
      } else if (availableAbove >= 180) {
        maxH = Math.min(280, availableAbove);
        top = Math.max(margin, (rect ? rect.top : caretPos.top) - maxH - 6);
      } else if (availableBelow >= availableAbove) {
        maxH = Math.max(120, availableBelow);
        top = (rect ? rect.bottom + 6 : caretPos.top);
      } else {
        maxH = Math.max(120, availableAbove);
        top = Math.max(margin, (rect ? rect.top : caretPos.top) - maxH - 6);
      }
      if (left + menuW + margin > window.innerWidth) left = Math.max(margin, window.innerWidth - menuW - margin);
      setVarsMenuPos({ left, top });
      setVarsMenuMaxH(maxH);
    } else {
      setVarsMenuPos(null);
      setVarsMenuMaxH(280);
    }
    // Focus filter input upon open via next tick handled in render
  };

  const toggleAct = (label: string) => setExpandedActs(prev => ({ ...prev, [label]: !prev[label] }));
  const toggleMain = (actLabel: string, mainLabel: string) => {
    const key = `${actLabel}::${mainLabel}`;
    setExpandedMains(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getDDTIcon = (kind?: string) => {
    try { return getDDTIconFromRE(String(kind || '')); } catch { return null as any; }
  };

  // Serialize contentEditable into NL string preserving tokens as {token}
  const serializeCE = (): string => {
    const root = nlCERef.current;
    if (!root) return nl;
    const collect = (node: Node): string => {
      if (node.nodeType === 3) return node.textContent || '';
      const el = node as HTMLElement;
      if (el.getAttribute && el.getAttribute('data-token')) return el.textContent || '';
      let out = '';
      el.childNodes.forEach(ch => { out += collect(ch); });
      return out;
    };
    return collect(root).replace(/\u00A0/g, ' ');
  };

  const handleKeyDownForField = (e: React.KeyboardEvent<HTMLElement>, field: 'nl' | 'script') => {
    if ((e.ctrlKey || e.metaKey) && (e.code === 'Space' || e.key === ' ')) {
      e.preventDefault();
      openVarsMenuFor(field, e.currentTarget as HTMLElement);
    } else if (e.key === 'Escape' && showVarsMenu) {
      e.preventDefault();
      setShowVarsMenu(false);
    }
  };

  const ConditionIcon = SIDEBAR_ICON_COMPONENTS[SIDEBAR_TYPE_ICONS.conditions];

  return (
    <div style={{ ...containerStyle, background: 'var(--sidebar-bg, #0b1220)', display: 'grid', gridTemplateRows: 'auto 1fr', gap: 6, padding: 12, zIndex: 50 }}>
      {/* Header with editable title and close */}
      <div
        onMouseEnter={() => setHeaderHover(true)}
        onMouseLeave={() => setHeaderHover(false)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: 'none', background: '#f59e0b', margin: '-12px -12px 6px -12px', borderTopLeftRadius: 6, borderTopRightRadius: 6 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isEditingTitle ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {ConditionIcon ? <ConditionIcon className="w-4 h-4" style={{ color: '#0b1220' }} /> : null}
              <span style={{ fontWeight: 700, color: '#0b1220' }}>{titleValue}</span>
              <button title="Edit title" onClick={() => setIsEditingTitle(true)} style={{ color: '#0b1220', visibility: headerHover ? 'visible' : 'hidden' }}>
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                autoFocus
                style={{ padding: '4px 6px', border: '1px solid #0b1220', borderRadius: 6, background: 'transparent', color: '#0b1220' }}
              />
              <button
                title="Confirm"
                onClick={() => { setIsEditingTitle(false); onRename?.(titleValue.trim() || 'Condition'); }}
                style={{ color: '#22c55e' }}
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                title="Cancel"
                onClick={() => { setIsEditingTitle(false); setTitleValue(label || 'Condition'); }}
                style={{ color: '#ef4444' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        <button onClick={onClose} title="Close" style={{ color: '#0b1220' }}>
          <X className="w-4 h-4" />
        </button>
      </div>
      {/* Controls + editor */}
      <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 6 }}>
        {/* Top controls: NL editor (contenteditable with chips) + Create/Save/Close */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            {!nl.trim() && (
              <div
                style={{
                  position: 'absolute',
                  left: 8,
                  top: 8,
                  color: '#94a3b8',
                  pointerEvents: 'none',
                  fontSize: 14
                }}
              >
                Describe in natural language when this condition should be true…
              </div>
            )}
            <div
              ref={nlCERef}
              contentEditable
              suppressContentEditableWarning
              onKeyDown={(e) => {
                handleKeyDownForField(e as any, 'nl');
                // While Intellisense is open, route arrow/enter to it even if caret is in the editor
                if (showVarsMenu && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
                  try { console.log('[ConditionEditor][Intellisense][editor-key]', e.key); } catch {}
                  e.preventDefault();
                  navigateIntellisense(e.key as any);
                  return;
                }
                // Block arrow/typing inside tokens
                const sel = window.getSelection();
                if (!sel) return;
                const anchor = sel.anchorNode as Node | null;
                const tokenEl = (anchor && (anchor.nodeType === 3 ? (anchor.parentElement as HTMLElement) : (anchor as HTMLElement)))?.closest?.('span[data-token]') as HTMLElement | null;
                const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
                if (tokenEl && printable) { e.preventDefault(); return; }
                if (tokenEl && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                  e.preventDefault();
                  if (e.key === 'ArrowLeft') {
                    const r = document.createRange(); r.setStartBefore(tokenEl); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
                  } else {
                    const r = document.createRange(); r.setStartAfter(tokenEl); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
                  }
                }
                if ((e.key === 'Backspace' || e.key === 'Delete') && sel.isCollapsed) {
                  const range = sel.getRangeAt(0);
                  if (e.key === 'Backspace') {
                    const prev = (range.startContainer as any).previousSibling || ((range.startContainer as any).parentElement && (range.startContainer as any).parentElement.previousSibling);
                    const el = (prev as HTMLElement) && (prev as HTMLElement).nodeType === 1 ? (prev as HTMLElement) : null;
                    if (el && el.matches && el.matches('span[data-token]')) {
                      e.preventDefault();
                      const r = document.createRange(); r.selectNode(el);
                      sel.removeAllRanges(); sel.addRange(r);
                      // eslint-disable-next-line deprecation/deprecation
                      document.execCommand('delete');
                      setNl(serializeCE());
                    }
                  } else {
                    const next = (range.startContainer as any).nextSibling || ((range.startContainer as any).parentElement && (range.startContainer as any).parentElement.nextSibling);
                    const el = (next as HTMLElement) && (next as HTMLElement).nodeType === 1 ? (next as HTMLElement) : null;
                    if (el && el.matches && el.matches('span[data-token]')) {
                      e.preventDefault();
                      const r = document.createRange(); r.selectNode(el);
                      sel.removeAllRanges(); sel.addRange(r);
                      // eslint-disable-next-line deprecation/deprecation
                      document.execCommand('delete');
                      setNl(serializeCE());
                    }
                  }
                }
              }}
              onInput={() => { setNl(serializeCE()); }}
              onPaste={(e) => { e.preventDefault(); const text = (e.clipboardData || (window as any).clipboardData).getData('text'); document.execCommand('insertText', false, text); }}
              style={{ minHeight: 38, padding: 8, border: '1px solid #334155', borderRadius: 6, color: '#e5e7eb', outline: 'none', whiteSpace: 'pre-wrap' }}
            />
          </div>
          <button disabled={busy} onClick={generate} title="create the script for the condition" style={{ border: '1px solid #334155', borderRadius: 6, padding: '6px 10px' }}>Create</button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { onSave?.(script); onClose(); }} style={{ border: '1px solid #334155', borderRadius: 6, padding: '6px 10px' }}>Save</button>
            <button onClick={onClose} style={{ border: '1px solid #334155', borderRadius: 6, padding: '6px 10px' }}>Close</button>
          </div>
        </div>
        {/* Editor directly under NL field */}
        <textarea
          ref={scriptRef}
          value={script}
          onChange={e => setScript(e.target.value)}
          onKeyDown={(e) => {
            handleKeyDownForField(e as any, 'script');
            if (showVarsMenu && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
              try { console.log('[ConditionEditor][Intellisense][script-key]', e.key); } catch {}
              e.preventDefault();
              navigateIntellisense(e.key as any);
            }
          }}
          placeholder="return true;"
          style={{ width: '100%', height: '100%', padding: 8, border: '1px solid #334155', borderRadius: 6, background: 'transparent', color: '#e5e7eb', fontFamily: 'monospace' }}
        />
        {/* Bottom row: Test + info */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <button onClick={test} style={{ border: '1px solid #334155', borderRadius: 6, padding: '6px 10px' }}>Test</button>
            <span style={{ color: '#e5e7eb', fontSize: 12, marginLeft: 8 }}>Result: {result || '—'}</span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>Script must return true/false.</div>
        </div>
      </div>
      {/* Variables Intellisense Menu */}
      {showVarsMenu && varsMenuAnchor && (
        <div
          ref={varsMenuRef}
          style={{
            position: 'fixed',
            left: varsMenuPos ? varsMenuPos.left : (varsMenuAnchor.getBoundingClientRect().left || 0),
            top: varsMenuPos ? varsMenuPos.top : (varsMenuAnchor.getBoundingClientRect().bottom || 0) + 6,
            width: 360,
            maxHeight: varsMenuMaxH,
            minHeight: 120,
            overflowY: 'scroll',
            paddingRight: 6,
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 8,
            zIndex: 9999,
            boxShadow: '0 8px 28px rgba(2,6,23,0.5)'
          }}
          onMouseEnter={() => setVarsMenuHover(true)}
          onMouseLeave={() => setVarsMenuHover(false)}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div style={{ padding: 8, borderBottom: '1px solid #334155' }}>
            <input
              value={varsMenuFilter}
              onChange={(e) => setVarsMenuFilter(e.target.value)}
              placeholder="Filter variables (type to search)"
              style={{ width: '100%', padding: 6, border: '1px solid #334155', borderRadius: 6, background: 'transparent', color: '#e5e7eb' }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { e.preventDefault(); setShowVarsMenu(false); }
                else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); navigateIntellisense(e.key); }
                else if (e.key === 'Enter') { e.preventDefault(); navigateIntellisense('Enter'); }
              }}
            />
          </div>
          <div style={{ padding: 6 }}>
            {/* Hierarchical tree (acts -> mains -> subs). Fallback to flat list if no tree provided */}
            {(variablesTree && (variablesTree.length > 0)) ? (
              (filteredTreeActs.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: 12, padding: 8 }}>No variables</div>
              ) : (
                filteredTreeActs.map((act, ai) => (
                  <div key={`act-${ai}`} style={{ marginBottom: 6 }}>
                    <div
                      data-nav-index={navIndexByKey.get(`ACT::${act.label}`) ?? -1}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, color: act.color || '#e5e7eb', fontWeight: 600, padding: '6px 8px', cursor: 'pointer', background: (navEntries[varsNavIndex]?.key === `ACT::${act.label}`) ? 'rgba(56,189,248,0.15)' : undefined }}
                      onClick={() => { setVarsNavIndex(navIndexByKey.get(`ACT::${act.label}`) ?? 0); toggleAct(act.label); }}
                    >
                      <span style={{ width: 12, display: 'inline-block', transform: expandedActs[act.label] ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.1s' }}>▶</span>
                      {act.Icon ? <act.Icon className="w-4 h-4" style={{ color: act.color || '#e5e7eb' }} /> : null}
                      <span>{act.label}</span>
                    </div>
                    {expandedActs[act.label] === true && (act.mains || []).map((m, mi) => (
                      <div key={`main-${ai}-${mi}`} style={{ marginLeft: 18 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            onClick={() => toggleMain(act.label, m.label)}
                            style={{ color: '#94a3b8' }}
                            title="Expand/Collapse"
                          >
                            <span style={{ width: 12, display: 'inline-block', transform: expandedMains[`${act.label}::${m.label}`] ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.1s' }}>▶</span>
                          </button>
                          <div
                            className="hover:bg-slate-700"
                            data-nav-index={navIndexByKey.get(`${act.label}.${m.label}`) ?? -1}
                            style={{ padding: '6px 8px', borderRadius: 6, color: '#e5e7eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flex: 1, background: (navEntries[varsNavIndex]?.token === `${act.label}.${m.label}`) ? 'rgba(56,189,248,0.15)' : undefined }}
                            onClick={() => { setVarsNavIndex(navIndexByKey.get(`${act.label}.${m.label}`) ?? 0); insertVariableToken(`${act.label}.${m.label}`); }}
                          >
                            {getDDTIcon(m.kind)}
                            <span>{m.label}</span>
                          </div>
                        </div>
                        {expandedMains[`${act.label}::${m.label}`] === true && (m.subs || []).map((s, si) => (
                          <div
                            key={`sub-${ai}-${mi}-${si}`}
                            className="hover:bg-slate-700"
                            data-nav-index={navIndexByKey.get(`${act.label}.${m.label}.${s.label}`) ?? -1}
                            style={{ padding: '6px 8px', borderRadius: 6, color: '#e5e7eb', cursor: 'pointer', marginLeft: 28, background: (navEntries[varsNavIndex]?.token === `${act.label}.${m.label}.${s.label}`) ? 'rgba(56,189,248,0.15)' : undefined }}
                            onClick={() => { setVarsNavIndex(navIndexByKey.get(`${act.label}.${m.label}.${s.label}`) ?? 0); insertVariableToken(`${act.label}.${m.label}.${s.label}`); }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              {getDDTIcon(s.kind)}
                              <span>{s.label}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))
              ))
            ) : (
              (filteredVarsForMenu.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: 12, padding: 8 }}>No variables</div>
              ) : (
                filteredVarsForMenu.map(k => (
                  <div
                    key={k}
                    data-nav-index={navIndexByKey.get(k) ?? -1}
                    style={{ padding: '6px 8px', borderRadius: 6, color: '#e5e7eb', cursor: 'pointer', background: (navEntries[varsNavIndex]?.token === k) ? 'rgba(56,189,248,0.15)' : undefined }}
                    className="hover:bg-slate-700"
                    onClick={() => { setVarsNavIndex(navIndexByKey.get(k) ?? 0); insertVariableToken(k); }}
                  >
                    {k}
                  </div>
                ))
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}


