/**
 * Project toolbar dialog: list remote ConvAI agents and open the selected one in a dock tab.
 */

import React from 'react';
import { Bot, Loader2, RefreshCw } from 'lucide-react';
import Modal from '@components/Modal';
import { ensureWorkspacesBootstrapped, getWorkspaceProvider, ELEVENLABS_WORKSPACE_PROVIDER_ID } from '@workspaces/index';

export type ImportElevenLabsAgentDialogProps = {
  open: boolean;
  onClose: () => void;
  onSelectAgent: (agent: { agentId: string; name: string }) => void;
};

export function ImportElevenLabsAgentDialog({
  open,
  onClose,
  onSelectAgent,
}: ImportElevenLabsAgentDialogProps): React.ReactElement {
  ensureWorkspacesBootstrapped();
  const provider = getWorkspaceProvider(ELEVENLABS_WORKSPACE_PROVIDER_ID);

  const [agents, setAgents] = React.useState<readonly { agentId: string; name: string }[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadAgents = React.useCallback(async () => {
    if (!provider) {
      setError('Provider ElevenLabs non registrato.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const page = await provider.listAgents({ pageSize: 100 });
      setAgents(page.agents);
    } catch (e) {
      setAgents([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [provider]);

  React.useEffect(() => {
    if (!open) return;
    void loadAgents();
  }, [open, loadAgents]);

  return (
    <Modal isOpen={open} onClose={onClose} title="Import Eleven Labs Agent" isLoading={loading}>
      <div className="space-y-4">
        <p className="text-sm text-slate-300">
          Seleziona un agente ConvAI remoto. Si aprirà in un tab accanto a{' '}
          <span className="font-medium text-violet-200">Main</span> con il mirror del workflow.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void loadAgents()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            )}
            Aggiorna lista
          </button>
        </div>
        {error ? (
          <p className="rounded-lg border border-rose-800/60 bg-rose-950/50 px-3 py-2 text-xs text-rose-200">
            {error}
          </p>
        ) : null}
        <ul className="max-h-[min(50vh,360px)] space-y-1 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/60 p-1">
          {agents.length === 0 && !loading && !error ? (
            <li className="px-3 py-6 text-center text-sm text-slate-500">Nessun agente trovato.</li>
          ) : null}
          {agents.map((a) => (
            <li key={a.agentId}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-slate-100 hover:bg-violet-900/40"
                onClick={() => {
                  onSelectAgent({ agentId: a.agentId, name: a.name });
                  onClose();
                }}
              >
                <Bot className="h-4 w-4 shrink-0 text-violet-400" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {a.name?.trim() || a.agentId}
                </span>
                <span className="shrink-0 text-xs text-slate-500">{a.agentId}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
