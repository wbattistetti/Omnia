/**
 * Default seeded text for structured sections when migrating from legacy flat prompts.
 */

/** Personalità: ruolo e atteggiamento (senza registro linguistico — vedi tab Tono). */
export const DEFAULT_PERSONALITY_SECTION_TEXT = `Who the agent is: role, empathy, and stance toward the user (2–4 short sentences).`;

/** Tono: prima riga `Tone: <token>` (valori in aiAgentStructuredSectionEnums). */
export const DEFAULT_TONE_SECTION_TEXT = `Tone: neutral

Brief, clear, empathetic; formality; typical sentence length.`;

/** Vincoli: struttura Must / Must not richiesta dal meta-prompt. */
export const DEFAULT_CONSTRAINTS_SECTION_TEXT = `Must:

Must not:

`;
