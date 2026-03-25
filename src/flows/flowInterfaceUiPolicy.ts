/**
 * Whether the Flow Interface panel (Input/Output) is shown for this flow canvas.
 * The outermost project flow (`main`) has no subflow-style interface; subflows do.
 */

export function isFlowInterfacePanelEnabled(flowId: string | undefined): boolean {
  return String(flowId ?? '').trim() !== '' && String(flowId).trim() !== 'main';
}
