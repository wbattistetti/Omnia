/**
 * Imports a remote workflow node snapshot into Omnia AI Agent task fields.
 * @deprecated Prefer {@link importElevenLabsNodeToOmnia} from `./elevenLabsOmniaImport` (same export).
 */

export {
  importElevenLabsNodeToOmnia,
  type ElevenLabsOmniaImportInput,
  type OmniaBackendCatalogTargets,
  type OmniaImportTargets,
  collectWebhookToolsForNode,
  mergeElevenLabsBackendsIntoCatalog,
  resolveSystemPromptForImport,
} from './elevenLabsOmniaImport';
