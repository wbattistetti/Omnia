import { describe, it, expect, vi } from 'vitest';
import { keepFlowGraphInView } from '../flowViewportKeepGraphVisible';

describe('keepFlowGraphInView', () => {
  it('pans to center graph when outside visible rect (keeps zoom)', () => {
    const setViewport = vi.fn();
    const instance = {
      getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
      setViewport,
    };
    const nodes = [
      { id: 'a', position: { x: 2000, y: 2000 }, width: 100, height: 50 },
    ];
    const changed = keepFlowGraphInView(instance, nodes, 800, 600);
    expect(changed).toBe(true);
    expect(setViewport).toHaveBeenCalledWith(
      expect.objectContaining({ zoom: 1 }),
      { duration: 0 }
    );
  });

  it('no-op when graph already inside viewport', () => {
    const setViewport = vi.fn();
    const instance = {
      getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
      setViewport,
    };
    const nodes = [{ id: 'a', position: { x: 50, y: 50 }, width: 100, height: 50 }];
    const changed = keepFlowGraphInView(instance, nodes, 800, 600);
    expect(changed).toBe(false);
    expect(setViewport).not.toHaveBeenCalled();
  });
});
