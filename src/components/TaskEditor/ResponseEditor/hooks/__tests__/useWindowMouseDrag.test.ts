import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWindowMouseDrag } from '@responseEditor/hooks/useWindowMouseDrag';

describe('useWindowMouseDrag', () => {
  beforeEach(() => {
    vi.spyOn(window, 'addEventListener');
    vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers window listeners when active', () => {
    const onMove = vi.fn();
    const onEnd = vi.fn();

    renderHook(() => useWindowMouseDrag(true, onMove, onEnd));

    expect(window.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
  });

  it('does not register when inactive', () => {
    const onMove = vi.fn();
    const onEnd = vi.fn();

    renderHook(() => useWindowMouseDrag(false, onMove, onEnd));

    expect(window.addEventListener).not.toHaveBeenCalled();
  });

  it('removes listeners on unmount when active', () => {
    const onMove = vi.fn();
    const onEnd = vi.fn();

    const { unmount } = renderHook(() => useWindowMouseDrag(true, onMove, onEnd));
    unmount();

    expect(window.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
  });

  it('invokes latest onMove when handler identity changes', () => {
    const first = vi.fn();
    const second = vi.fn();
    const onEnd = vi.fn();

    const { rerender } = renderHook(
      ({ move }: { move: (e: MouseEvent) => void }) =>
        useWindowMouseDrag(true, move, onEnd),
      { initialProps: { move: first } }
    );

    const moveListener = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === 'mousemove'
    )?.[1] as (e: MouseEvent) => void;
    expect(moveListener).toBeDefined();

    const ev = new MouseEvent('mousemove', { clientX: 10 });
    moveListener(ev);
    expect(first).toHaveBeenCalledWith(ev);
    expect(second).not.toHaveBeenCalled();

    rerender({ move: second });
    moveListener(new MouseEvent('mousemove', { clientX: 20 }));
    expect(second).toHaveBeenCalled();
  });
});
