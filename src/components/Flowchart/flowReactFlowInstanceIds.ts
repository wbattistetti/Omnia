/**
 * Unique React Flow / Background ids per canvas instance (avoids shared SVG pattern defs in the DOM).
 */

export function omniaFlowReactFlowId(flowCanvasId: string): string {
  const safe = String(flowCanvasId || 'main')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  return `omnia-flow-${safe}`;
}

export function omniaFlowBackgroundPatternId(flowCanvasId: string): string {
  return `${omniaFlowReactFlowId(flowCanvasId)}-dots`;
}

export const ELEVENLABS_WORKFLOW_REACT_FLOW_ID = 'elevenlabs-convai-workflow';
export const ELEVENLABS_WORKFLOW_BACKGROUND_ID = 'elevenlabs-convai-workflow-dots';
