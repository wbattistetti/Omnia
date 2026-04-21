/**
 * Barrel: runtime IA agent setup helpers (visibility, defaults, persistence, normalization).
 */

export { getVisibleFields, getDefaultConfig } from './platformHelpers';
export { loadGlobalIaAgentConfig, saveGlobalIaAgentConfig } from './globalIaAgentPersistence';
export { normalizeIAAgentConfig } from './iaAgentConfigNormalize';
export { computeSectionOverrides, type SectionOverrideFlags } from './overrideFields';
