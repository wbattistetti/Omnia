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
