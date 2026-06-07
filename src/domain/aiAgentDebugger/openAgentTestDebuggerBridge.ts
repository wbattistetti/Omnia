/**
 * Bridge sincrono editor AI Agent → debugger globale AppContent.
 * Evita race con CustomEvent quando il listener non è ancora registrato.
 */

import {
  OMNIA_OPEN_AGENT_TEST_DEBUGGER,
  type OpenAgentTestDebuggerDetail,
} from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/aiAgentDockPanelIds';
import { setCompilationErrorsGlobal } from '@context/CompilationErrorsContext';

type OpenAgentTestDebuggerFn = (detail: OpenAgentTestDebuggerDetail) => void;

let registeredOpener: OpenAgentTestDebuggerFn | null = null;

/** Registra l'handler AppContent; ritorna unregister. */
export function registerOpenAgentTestDebugger(opener: OpenAgentTestDebuggerFn): () => void {
  registeredOpener = opener;
  return () => {
    if (registeredOpener === opener) registeredOpener = null;
  };
}

function dispatchOpenAgentTestDebugger(payload: OpenAgentTestDebuggerDetail): void {
  if (registeredOpener) {
    registeredOpener(payload);
    return;
  }
  document.dispatchEvent(
    new CustomEvent(OMNIA_OPEN_AGENT_TEST_DEBUGGER, { bubbles: true, detail: payload })
  );
}

/** Apre il debugger test agente (bridge diretto, fallback CustomEvent). */
export function openAgentTestDebugger(detail: OpenAgentTestDebuggerDetail): void {
  const agentTaskId = String(detail?.agentTaskId ?? '').trim();
  if (!agentTaskId) {
    throw new Error('Test agente: taskId mancante.');
  }
  const payload: OpenAgentTestDebuggerDetail = {
    agentTaskId,
    taskLabel: String(detail?.taskLabel ?? '').trim() || undefined,
    autoStartDialogue: detail.autoStartDialogue,
    deployCompileErrors: detail.deployCompileErrors,
  };
  dispatchOpenAgentTestDebugger(payload);
}

/** Apre debugger con report pre-deploy (compile/KB); non avvia il dialogo automaticamente. */
export function openAgentDeployDebugger(detail: OpenAgentTestDebuggerDetail): void {
  const agentTaskId = String(detail?.agentTaskId ?? '').trim();
  if (!agentTaskId) {
    throw new Error('Deploy: taskId mancante.');
  }
  if (detail.deployCompileErrors !== undefined) {
    setCompilationErrorsGlobal(detail.deployCompileErrors);
  }
  openAgentTestDebugger({
    ...detail,
    agentTaskId,
    autoStartDialogue: false,
  });
}
