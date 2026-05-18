import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  getFlowCanvasHost,
  queryAllFlowNodesInCanvas,
  queryWithinFlowCanvasHost,
} from '../flowCanvasDom';

describe('flowCanvasDom', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement('div');
    host.setAttribute('data-flow-canvas-id', 'main');
    host.innerHTML =
      '<div class="react-flow"><div class="react-flow__node" data-id="a"></div></div>';
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
  });

  it('finds canvas host by flow id', () => {
    expect(getFlowCanvasHost('main')).toBe(host);
    expect(getFlowCanvasHost('other')).toBeNull();
  });

  it('queries within host only', () => {
    const other = document.createElement('div');
    other.setAttribute('data-flow-canvas-id', 'other');
    other.innerHTML = '<div class="react-flow__node" data-id="b"></div>';
    document.body.appendChild(other);

    expect(queryWithinFlowCanvasHost(host, '.react-flow')).not.toBeNull();
    expect(queryAllFlowNodesInCanvas('main')).toHaveLength(1);
    expect(queryAllFlowNodesInCanvas('other')).toHaveLength(1);

    other.remove();
  });
});
