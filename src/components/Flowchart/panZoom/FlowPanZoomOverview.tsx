/**
 * Conditional MiniMap — unmounted when not needed so RF does not repaint it every viewport frame.
 */

import React, { useMemo, type RefObject } from 'react';
import { MiniMap, type Node } from 'reactflow';
import { useFlowPanZoomNeeded } from './useFlowPanZoomNeeded';
import { nodesHaveFinitePositions } from '../utils/flowPositionGuards';
import './flowPanZoomOverview.css';

export type FlowPanZoomTheme = 'light' | 'dark';

export type FlowPanZoomOverviewProps = {
  flowCanvasId: string;
  nodes: readonly Node[];
  viewportHostRef?: RefObject<HTMLElement | null>;
  theme?: FlowPanZoomTheme;
  reactFlowInstanceId?: string;
};

const THEME_STYLES: Record<
  FlowPanZoomTheme,
  { nodeColor: string; maskColor: string; maskStrokeColor: string }
> = {
  light: {
    nodeColor: '#a78bfa',
    maskColor: 'rgba(255,255,255,0.72)',
    maskStrokeColor: '#6366f1',
  },
  dark: {
    nodeColor: '#64748b',
    maskColor: 'rgba(15,23,42,0.55)',
    maskStrokeColor: '#a78bfa',
  },
};

export function FlowPanZoomOverview({
  flowCanvasId,
  nodes,
  viewportHostRef,
  theme = 'light',
  reactFlowInstanceId,
}: FlowPanZoomOverviewProps): React.ReactElement | null {
  const positionsOk = useMemo(() => nodesHaveFinitePositions(nodes), [nodes]);
  const needed = useFlowPanZoomNeeded(flowCanvasId, nodes, viewportHostRef);

  if (nodes.length === 0 || !positionsOk || !needed) {
    return null;
  }

  const palette = THEME_STYLES[theme];

  return (
    <MiniMap
      id={reactFlowInstanceId ? `${reactFlowInstanceId}-minimap` : undefined}
      position="bottom-right"
      pannable
      zoomable
      ariaLabel="Panoramica grafo"
      className={`flow-panzoom flow-panzoom--${theme}`}
      style={{ width: 168, height: 112 }}
      nodeColor={palette.nodeColor}
      nodeStrokeColor={theme === 'light' ? '#7c3aed' : '#94a3b8'}
      maskColor={palette.maskColor}
      maskStrokeColor={palette.maskStrokeColor}
      maskStrokeWidth={2}
    />
  );
}
