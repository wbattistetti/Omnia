import { describe, expect, it } from 'vitest';
import {
  getPaletteTaskDragActive,
  setPaletteTaskDragActive,
  subscribePaletteTaskDrag,
} from '../paletteTaskDragBridge';

describe('paletteTaskDragBridge', () => {
  it('notifies subscribers when palette drag becomes active', () => {
    setPaletteTaskDragActive(false);
    const seen: boolean[] = [];
    const unsub = subscribePaletteTaskDrag((active) => seen.push(active));
    setPaletteTaskDragActive(true);
    setPaletteTaskDragActive(false);
    unsub();
    expect(seen).toEqual([false, true, false]);
    expect(getPaletteTaskDragActive()).toBe(false);
  });
});
