/**
 * Mappa controlli pre-deploy KB deterministico → errori report debugger (CompilationErrorsContext).
 */

import type { CompilationError } from '@components/FlowCompiler/types';
import type { KbDialogDeployIssue } from '@domain/convai/kbDialogDeployReadiness';

function deployIssueToCompileError(agentTaskId: string, issue: KbDialogDeployIssue): CompilationError {
  return {
    taskId: agentTaskId,
    message: issue.message,
    severity: 'error',
    code: 'IaProvisionProviderError',
    fixTarget: { type: 'task', taskId: agentTaskId },
  };
}

/** Errori UX per il report debugger prima/durante deploy ConvAI. */
export function buildAgentDeployCompileErrors(
  agentTaskId: string,
  kbIssues: readonly KbDialogDeployIssue[],
  extraMessages: readonly string[] = []
): CompilationError[] {
  const tid = String(agentTaskId ?? '').trim();
  if (!tid) return [];
  const out: CompilationError[] = kbIssues.map((issue) => deployIssueToCompileError(tid, issue));
  for (const msg of extraMessages) {
    const text = String(msg ?? '').trim();
    if (!text) continue;
    out.push({
      taskId: tid,
      message: text,
      severity: 'error',
      code: 'IaProvisionProviderError',
      fixTarget: { type: 'task', taskId: tid },
    });
  }
  return out;
}
