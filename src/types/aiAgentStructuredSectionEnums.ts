/**
 * Enumerated tone token for the Tono tab (first line: `Tone: <token>`).
 */

export const AGENT_TONE_TOKENS = [
  'neutral',
  'friendly_professional',
  'warm',
  'concise',
  'formal',
  'playful',
] as const;

export type AgentToneToken = (typeof AGENT_TONE_TOKENS)[number];

/** @deprecated use AGENT_TONE_TOKENS */
export const AGENT_PERSONALITY_TONES = AGENT_TONE_TOKENS;

/** @deprecated use AgentToneToken */
export type AgentPersonalityTone = AgentToneToken;

export function isAgentToneToken(s: string): s is AgentToneToken {
  return (AGENT_TONE_TOKENS as readonly string[]).includes(s);
}

/**
 * Parses `Tone: token` from the first non-empty line of the tone section body.
 */
export function parseToneTokenFromSection(text: string): AgentToneToken | undefined {
  const first = String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!first) return undefined;
  const m = /^Tone:\s*([a-z0-9_]+)\s*$/i.exec(first);
  if (!m) return undefined;
  const token = m[1].toLowerCase();
  return isAgentToneToken(token) ? token : undefined;
}

/** @deprecated use parseToneTokenFromSection */
export const parseToneFromPersonalitySection = parseToneTokenFromSection;
