/**
 * PanZoom hook — semantic events only; mocked React Flow store.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { emitViewportSettled } from '../../semantic/flowCanvasSemanticEvents';

const mockGetState = vi.fn();

vi.mock('reactflow', () => ({
  useStoreApi: () => ({
    getState: mockGetState,
  }),
}));

import { useFlowPanZoomNeeded } from '../useFlowPanZoomNeeded';

describe('useFlowPanZoomNeeded', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetState.mockReturnValue({
      transform: [0, 0, 1],
      width: 800,
      height: 600,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('evaluates on VIEWPORT_SETTLED without nodes position subscription', () => {
    const nodes = [
      { id: 'n1', position: { x: 0, y: 0 }, width: 100, height: 50 },
    ] as const;

    const { result } = renderHook(() => useFlowPanZoomNeeded('main', nodes));

    expect(result.current).toBe(false);

    act(() => {
      emitViewportSettled('main', { x: 0, y: 0, zoom: 1 });
    });

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(mockGetState).toHaveBeenCalled();
  });

  it('ignores semantic events for other flow canvases', () => {
    const nodes = [{ id: 'n1', position: { x: 0, y: 0 } }] as const;
    const { result } = renderHook(() => useFlowPanZoomNeeded('main', nodes));

    act(() => {
      emitViewportSettled('other-flow', { x: 0, y: 0, zoom: 1 });
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe(false);
    expect(mockGetState).not.toHaveBeenCalled();
  });
});
