/**
 * Italian labels for ElevenLabs ConvAI system tool names (workflow «Strumenti integrati»).
 */

const SYSTEM_TOOL_LABELS_IT: Record<string, string> = {
  end_call: 'Termina conversazione',
  language_detection: 'Rileva lingua',
  skip_turn: 'Salta turno',
  transfer_to_agent: 'Trasferimento ad agente',
  transfer_to_number: 'Trasferimento a numero',
  play_keypad_touch_tone: 'Riproduci il tono del tastierino',
  voicemail_detection: 'Rilevamento della segreteria telefonica',
  update_conversation_state: 'Aggiorna stato',
  conversation_state_update: 'Aggiorna stato',
};

/** Resolves display label for a ConvAI system tool id/name. */
export function convaiSystemToolLabelIt(name: string): string {
  const key = name.trim().toLowerCase();
  return SYSTEM_TOOL_LABELS_IT[key] ?? (name.trim() || '—');
}
