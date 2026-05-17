/** Primary workspace views aligned with ElevenLabs ConvAI UI. */
export type ElevenLabsWorkspaceTab = 'agent' | 'workflow' | 'webhooks';

export const ELEVENLABS_WORKSPACE_TABS: readonly {
  id: ElevenLabsWorkspaceTab;
  label: string;
}[] = [
  { id: 'agent', label: 'Agente' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'webhooks', label: 'Webhook' },
];
