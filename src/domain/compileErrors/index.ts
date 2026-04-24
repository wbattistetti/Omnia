/**
 * Sottosistema errori di compilazione: chiavi canoniche, messaggi UX, navigazione.
 */

export type { CompileMessageKey } from './compileMessageKeys';
export type { CompileUxMessageCode } from './compileUxMessages';
export {
  COMPILE_ERROR_REPORT_UX_CODES,
  isCompileErrorReportUxCode,
  resolveCompileUxMessage,
} from './compileUxMessages';
export type { CompileErrorContext, NormalizedCompileError } from './compileMessages';
export {
  normalizeCompilerError,
  resolveMessage,
  resolveCompilationUserMessage,
  shouldSuppressTechnicalDetailForError,
} from './compileMessages';
export type { NavigationIntent } from './compileNavigation';
export {
  resolveNavigationIntent,
  resolveCompilationNavigation,
  executeNavigationIntent,
} from './compileNavigation';
export {
  mergeAiAgentTaskLocations,
  collectIaAgentRuntimeCompileErrors,
} from './collectIaAgentRuntimeCompileErrors';
export type { AiAgentTaskLocation } from './collectIaAgentRuntimeCompileErrors';
export type { NormalizedIaProviderError, ProviderErrorAdapter } from './iaProviderErrors';
export { providerErrorAdapters } from './providerErrorRegistry';
export { normalizeProviderError } from './normalizeProviderError';
export { inferFixAction, providerFixActionToIaRuntimeFocus } from './fixActions';
export type { ProviderFixActionId } from './fixActions';
export {
  setIaProvisioningError,
  getIaProvisioningError,
} from './iaProvisioningErrorStore';
export { elevenLabsErrorAdapter } from './elevenLabsErrorAdapter';
