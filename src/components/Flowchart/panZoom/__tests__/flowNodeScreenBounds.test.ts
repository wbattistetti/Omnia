import { describe, expect, it } from 'vitest';
import {
  hasAnyNodeEstimatedPartiallyOutsidePane,
  hasAnyNodeDomPartiallyOutsidePane,
} from '../flowNodeScreenBounds';

describe('flowNodeScreenBounds', () => {
  const pane = { left: 100, top: 50, width: 400, height: 350 };
  const viewport = { x: 0, y: 0, zoom: 1 };

  it('detects wide node past right edge using flow estimate', () => {
    const nodes = [
      {
        id: 'a',
        position: { x: 350, y: 10 },
        data: { rows: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }] },
        width: 320,
        height: 120,
      },
    ];
    expect(hasAnyNodeEstimatedPartiallyOutsidePane(nodes, viewport, pane)).toBe(true);
  });

  it('detects DOM node partially outside viewport clip', () => {
    const host = document.createElement('div');
    const viewportEl = document.createElement('div');
    viewportEl.className = 'react-flow';
    Object.defineProperty(viewportEl, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 50, width: 400, height: 350, right: 500, bottom: 400 }),
    });
    const nodeEl = document.createElement('div');
    nodeEl.className = 'react-flow__node';
    Object.defineProperty(nodeEl, 'getBoundingClientRect', {
      value: () => ({ left: 420, top: 80, width: 200, height: 90, right: 620, bottom: 170 }),
    });
    host.appendChild(viewportEl);
    host.appendChild(nodeEl);

    expect(hasAnyNodeDomPartiallyOutsidePane(host)).toBe(true);
  });
});
