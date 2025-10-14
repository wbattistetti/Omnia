import { useCallback, useEffect, useRef, useState } from 'react';

type ToolbarState = 'hidden' | 'toolbar' | 'picker';

export function useRowToolbar({
  rowRef,
  overlayRef,
  pickerRef
}: {
  rowRef: React.RefObject<HTMLElement>;
  overlayRef: React.RefObject<HTMLElement>;
  pickerRef: React.RefObject<HTMLElement>;
}) {
  const [state, setState] = useState<ToolbarState>('hidden');
  const hideTimerRef = useRef<number | null>(null);

  const clearTimer = () => { if (hideTimerRef.current) { window.clearTimeout(hideTimerRef.current); hideTimerRef.current = null; } };

  const contains = (root?: HTMLElement | null, n?: Node | null) => !!(root && n && root.contains(n));

  const rowEnter = useCallback(() => { clearTimer(); setState((s) => (s === 'picker' ? s : 'toolbar')); }, []);

  const rowLeave = useCallback((e: React.MouseEvent | MouseEvent) => {
    clearTimer();
    const next = (e as any).relatedTarget as Node | null;
    if (contains(overlayRef.current || null, next) || contains(pickerRef.current || null, next)) {
      setState((s) => (s === 'hidden' ? 'toolbar' : s));
      return;
    }
    if (state === 'picker') { setState('picker'); return; }
    hideTimerRef.current = window.setTimeout(() => setState('hidden'), 120);
  }, [overlayRef, pickerRef, state]);

  const overlayEnter = useCallback(() => { clearTimer(); setState((s) => (s === 'hidden' ? 'toolbar' : s)); }, []);
  const overlayLeave = useCallback((e?: React.MouseEvent | MouseEvent) => {
    clearTimer();
    const next = e ? (e as any).relatedTarget as Node | null : null;
    if (contains(rowRef.current || null, next) || contains(pickerRef.current || null, next)) return;
    if (state === 'picker') { setState('picker'); return; }
    hideTimerRef.current = window.setTimeout(() => setState('hidden'), 120);
  }, [rowRef, pickerRef, state]);

  const openPicker = useCallback(() => { clearTimer(); setState('picker'); }, []);
  const closePicker = useCallback(() => { clearTimer(); setState('toolbar'); }, []);

  // Robust outside detection using pointerdown capture + composedPath()
  const inPath = (ev: Event, el?: HTMLElement | null) => !!el && typeof (ev as any).composedPath === 'function' && (ev as any).composedPath().includes(el);
  const onDocPointerDown = useCallback((ev: PointerEvent) => {
    if (inPath(ev, rowRef.current) || inPath(ev, overlayRef.current) || inPath(ev, pickerRef.current)) return;
    setState('hidden');
  }, [rowRef, overlayRef, pickerRef]);

  useEffect(() => {
    document.addEventListener('pointerdown', onDocPointerDown, true);
    return () => document.removeEventListener('pointerdown', onDocPointerDown, true);
  }, [onDocPointerDown]);

  return {
    state,
    showIcons: state !== 'hidden',
    showPicker: state === 'picker',
    row: { onEnter: rowEnter, onLeave: rowLeave },
    overlay: { onEnter: overlayEnter, onLeave: overlayLeave },
    picker: { open: openPicker, close: closePicker },
  } as const;
}


