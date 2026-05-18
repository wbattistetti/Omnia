import { describe, expect, it, vi } from 'vitest';
import { commitNodeMeasuredDimensions } from '../commitNodeMeasuredDimensions';

describe('commitNodeMeasuredDimensions', () => {
  it('updates width/height on the matching node only', () => {
    const updateNodeInternals = vi.fn();
    let next: { id: string; width?: number; height?: number }[] = [];
    const setNodes = (fn: (nodes: { id: string; width?: number; height?: number }[]) => typeof next) => {
      next = fn([{ id: 'a', position: { x: 0, y: 0 }, width: 100, height: 40 } as any]);
    };
    commitNodeMeasuredDimensions('a', 180, 90, setNodes as any, updateNodeInternals);
    expect(next[0].width).toBe(180);
    expect(next[0].height).toBe(90);
    expect(updateNodeInternals).toHaveBeenCalledWith('a');
  });

  it('no-ops when size unchanged within epsilon', () => {
    const updateNodeInternals = vi.fn();
    const initial = [{ id: 'a', width: 100, height: 40 }];
    const setNodes = vi.fn((fn: (nodes: typeof initial) => typeof initial) => fn(initial));
    commitNodeMeasuredDimensions('a', 100, 40, setNodes as any, updateNodeInternals);
    expect(setNodes).toHaveBeenCalledTimes(1);
    expect(updateNodeInternals).not.toHaveBeenCalled();
  });
});
