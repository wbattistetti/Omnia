import { describe, it, expect } from 'vitest';
import {
  getRoundedVHVPath,
  getRoundedHVHPath,
  getRoundedAutoOrthoPath,
  getVHVPath,
  VHV_COLLINEAR_EPS_PX,
} from './edgeRouting';

describe('rounded ortho paths', () => {
  it('VHV uses Q when there is room', () => {
    const d = getRoundedVHVPath(0, 0, 100, 200, 8);
    expect(d).toContain('Q');
    expect(d).toMatch(/^M /);
  });

  it('VHV collapses to vertical when almost same X', () => {
    const x = 50;
    const tx = x + VHV_COLLINEAR_EPS_PX / 2;
    const d = getRoundedVHVPath(x, 0, tx, 100, 8);
    expect(d).not.toContain('Q');
    expect(d).toContain('L');
  });

  it('HVH uses Q for typical elbow', () => {
    const d = getRoundedHVHPath(0, 0, 200, 150, 8);
    expect(d).toContain('Q');
  });

  it('auto ortho picks VHV when dy > dx', () => {
    const sharp = getVHVPath(0, 0, 40, 200);
    expect(sharp.split('L').length).toBe(4);
    const rounded = getRoundedAutoOrthoPath(0, 0, 40, 200, 8);
    expect(rounded).toContain('Q');
  });
});
