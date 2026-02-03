// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * @deprecated This file is being refactored into modular components.
 * Please use the new modules in src/utils/contract/ instead.
 * This file maintains backward compatibility by re-exporting from new modules.
 */

// Re-export from new modular structure
export { buildSemanticContract } from './contract/buildEntity';
export {
  readEntityDescription,
  readEntityConstraints,
  readEntityNormalization,
  readRedefinitionPolicy
} from './contract/readEntityProperties';
export {
  buildSubgroup,
  buildSubgroups
} from './contract/buildSubgroups';
export {
  readSubgroupMeaning,
  readSubgroupOptionality,
  readSubgroupFormats,
  readSubgroupNormalization,
  readSubgroupConstraints
} from './contract/readSubgroupProperties';
