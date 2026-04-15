/**
 * Whether Input/Output (flowInterface) sections appear in the side rail for this flow.
 * The project root flow (`main`) has no subflow-style interface; child/subflow canvases do.
 */

export function isFlowInterfacePanelEnabled(flowId: string | undefined): boolean {
  return String(flowId ?? '').trim() !== '' && String(flowId).trim() !== 'main';
}
