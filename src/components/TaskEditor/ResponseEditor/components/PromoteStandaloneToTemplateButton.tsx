/**
 * MVP: promotes a standalone task to a project template + instance row (single root, no sub-nodes, GUID ids).
 */

import React from 'react';
import { taskRepository } from '@services/TaskRepository';
import {
  canPromoteStandaloneToProjectTemplateMvp,
  promoteStandaloneToProjectTemplate,
} from '@utils/promoteStandaloneToProjectTemplate';

export type PromoteStandaloneToTemplateButtonProps = {
  taskId: string | undefined;
  projectId: string | null;
  /** Bump when task row or tree changes (e.g. taskTreeVersion). */
  refreshToken?: unknown;
  onPromoted: () => void | Promise<void>;
};

export function PromoteStandaloneToTemplateButton({
  taskId,
  projectId,
  refreshToken,
  onPromoted,
}: PromoteStandaloneToTemplateButtonProps) {
  const [busy, setBusy] = React.useState(false);

  const can = React.useMemo(() => {
    if (!taskId || !projectId) {
      return false;
    }
    return canPromoteStandaloneToProjectTemplateMvp(taskRepository.getTask(taskId));
  }, [taskId, projectId, refreshToken]);

  if (!can) {
    return null;
  }

  const handleClick = async () => {
    if (!taskId || !projectId || busy) {
      return;
    }
    setBusy(true);
    try {
      await promoteStandaloneToProjectTemplate(taskId, projectId);
      await onPromoted();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      data-testid="promote-standalone-to-template"
      title="Save structure as project template(s) and bind this row as an instance. Every node must use a GUID id; composite trees are posted in post-order (children first)."
      disabled={busy}
      onClick={handleClick}
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: 8,
        border: '1px solid rgba(0,0,0,0.15)',
        background: '#fff',
        color: '#7c2d12',
        cursor: busy ? 'wait' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {busy ? 'Promoting…' : 'Promote to template'}
    </button>
  );
}
