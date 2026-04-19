import { afterEach, describe, expect, it, vi } from 'vitest';
import { dropTargetsSubflowPortalRow, resolveCrossNodeDropHitTest } from '../crossNodeRowDropHitTest';

describe('dropTargetsSubflowPortalRow', () => {
  it('is true only for portal region or matching portal row id', () => {
    expect(
      dropTargetsSubflowPortalRow({
        targetRegion: 'portal',
        targetRowId: null,
        portalTaskRowId: 'p1',
      })
    ).toBe(true);
    expect(
      dropTargetsSubflowPortalRow({
        targetRegion: 'row',
        targetRowId: 'p1',
        portalTaskRowId: 'p1',
      })
    ).toBe(true);
    expect(
      dropTargetsSubflowPortalRow({
        targetRegion: 'row',
        targetRowId: 'other',
        portalTaskRowId: 'p1',
      })
    ).toBe(false);
    expect(
      dropTargetsSubflowPortalRow({
        targetRegion: 'node',
        targetRowId: null,
        portalTaskRowId: 'p1',
      })
    ).toBe(false);
    expect(
      dropTargetsSubflowPortalRow({
        targetRegion: 'portal',
        targetRowId: null,
        portalTaskRowId: null,
      })
    ).toBe(false);
  });
});

describe('resolveCrossNodeDropHitTest', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    if (typeof (document as unknown as { elementsFromPoint?: (x: number, y: number) => Element[] })
      .elementsFromPoint !== 'function') {
      (document as unknown as { elementsFromPoint: (x: number, y: number) => Element[] }).elementsFromPoint =
        () => [];
    }
  });

  function mountFixture(html: string) {
    document.body.innerHTML = html;
  }

  it('returns portal when pointer is over portal row', () => {
    mountFixture(`
      <div data-id="node-a" style="position:relative;width:200px;height:200px;">
        <div class="node-row-outer" data-index="0" data-row-id="r-name" data-omnia-flow-row-id="r-name" data-omnia-subflow-portal-row="false"
             style="position:absolute;top:10px;height:24px;width:180px;"></div>
        <div class="node-row-outer" data-index="1" data-row-id="r-portal" data-omnia-flow-row-id="r-portal" data-omnia-subflow-portal-row="true"
             style="position:absolute;top:40px;height:24px;width:180px;"></div>
      </div>
    `);
    const root = document.querySelector('[data-id="node-a"]') as HTMLElement;
    const rowPortal = document.querySelector('[data-omnia-subflow-portal-row="true"]') as HTMLElement;
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([rowPortal, root] as unknown as Element[]);

    const hit = resolveCrossNodeDropHitTest(50, 50, 'node-a');
    expect(hit.targetRegion).toBe('portal');
    expect(hit.targetRowId).toBe('r-portal');
    expect(hit.portalRowIdOnTargetNode).toBe('r-portal');
  });

  it('returns row when pointer is over a non-portal row', () => {
    mountFixture(`
      <div data-id="node-a" style="position:relative;width:200px;height:200px;">
        <div class="node-row-outer" data-index="0" data-row-id="r-name" data-omnia-flow-row-id="r-name" data-omnia-subflow-portal-row="false"
             style="position:absolute;top:10px;height:24px;width:180px;"></div>
        <div class="node-row-outer" data-index="1" data-row-id="r-portal" data-omnia-flow-row-id="r-portal" data-omnia-subflow-portal-row="true"
             style="position:absolute;top:40px;height:24px;width:180px;"></div>
      </div>
    `);
    const root = document.querySelector('[data-id="node-a"]') as HTMLElement;
    const rowNormal = document.querySelector('[data-row-id="r-name"]') as HTMLElement;
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([rowNormal, root] as unknown as Element[]);

    const hit = resolveCrossNodeDropHitTest(10, 20, 'node-a');
    expect(hit.targetRegion).toBe('row');
    expect(hit.targetRowId).toBe('r-name');
  });

  it('returns node when pointer is inside RF node but not over any row', () => {
    mountFixture(`
      <div data-id="node-a" style="position:relative;width:200px;height:120px;padding:8px;">
        <div class="node-row-outer" data-index="0" data-row-id="r1" data-omnia-flow-row-id="r1" data-omnia-subflow-portal-row="false"
             style="height:20px;width:100%;"></div>
      </div>
    `);
    const root = document.querySelector('[data-id="node-a"]') as HTMLElement;
    const rr = root.getBoundingClientRect();
    const x = rr.right - 4;
    const y = rr.bottom - 4;
    const hit = resolveCrossNodeDropHitTest(x, y, 'node-a');
    expect(hit.targetRegion).toBe('node');
    expect(hit.targetRowId).toBeNull();
  });

  it('uses data-row-id when omnia-flow-row-id is absent', () => {
    mountFixture(`
      <div data-id="node-a" style="position:relative;width:200px;height:80px;">
        <div class="node-row-outer" data-index="0" data-row-id="legacy-only" data-omnia-subflow-portal-row="false"
             style="height:24px;width:180px;"></div>
      </div>
    `);
    const root = document.querySelector('[data-id="node-a"]') as HTMLElement;
    const row = document.querySelector('.node-row-outer') as HTMLElement;
    vi.spyOn(document, 'elementsFromPoint').mockReturnValue([row, root] as unknown as Element[]);

    const hit = resolveCrossNodeDropHitTest(2, 2, 'node-a');
    expect(hit.targetRowId).toBe('legacy-only');
    expect(hit.targetRegion).toBe('row');
  });
});
