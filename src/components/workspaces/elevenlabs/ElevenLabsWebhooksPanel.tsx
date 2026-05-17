/**
 * Aggregated webhook/client tools across agent and workflow nodes (read-only).
 */

import React from 'react';
import type { WorkspaceAgentToolInventory, WorkspaceResolvedTool } from '@workspaces/core/types';
import type { ProjectData } from '@types/project';
import { ElevenLabsToolListRow } from './ElevenLabsToolListRow';
import { ElevenLabsWorkspaceWebhookSection } from './ElevenLabsWorkspaceWebhookSection';

export type ElevenLabsWebhooksPanelProps = {
  toolInventory: WorkspaceAgentToolInventory;
  agentId: string;
  projectData?: ProjectData | null;
  projectId?: string;
  updateProjectData?: (data: ProjectData) => void;
};

function isWebhookLike(t: WorkspaceResolvedTool): boolean {
  return (
    t.kind === 'webhook' ||
    t.kind === 'api_integration_webhook' ||
    t.kind === 'client' ||
    Boolean(t.url)
  );
}

function scopeLabel(t: WorkspaceResolvedTool): string {
  if (t.scope === 'agent') return 'Agente';
  if (t.nodeLabel?.trim()) return `Nodo · ${t.nodeLabel.trim()}`;
  if (t.nodeId?.trim()) return `Nodo · ${t.nodeId.trim()}`;
  return 'Nodo';
}

export function ElevenLabsWebhooksPanel({
  toolInventory,
  agentId,
  projectData,
  projectId,
  updateProjectData,
}: ElevenLabsWebhooksPanelProps): React.ReactElement {
  const rows = toolInventory.allTools.filter(isWebhookLike);

  return (
    <div className="h-full overflow-y-auto overscroll-y-contain px-4 py-4 [scrollbar-gutter:stable]">
      <div className="mx-auto max-w-3xl space-y-4">
        <header>
          <h2 className="text-lg font-semibold text-violet-100">Webhook e tool client</h2>
          <p className="mt-1 text-xs text-slate-400">
            Vista aggregata (sola lettura): tool a livello agente e aggiuntivi per nodo, con URL quando
            disponibile dall&apos;API ConvAI.
          </p>
        </header>
        <section className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Nuovo webhook (catalogo progetto)
          </h3>
          <ElevenLabsWorkspaceWebhookSection
            projectData={projectData}
            projectId={projectId}
            updateDataDirectly={updateProjectData}
            catalogScope={{ scope: 'agent', agentId }}
          />
        </section>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">Nessun webhook o tool client risolto per questo agente.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full min-w-[520px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-semibold">Tool</th>
                  <th className="px-3 py-2 font-semibold">Metodo</th>
                  <th className="px-3 py-2 font-semibold">URL</th>
                  <th className="px-3 py-2 font-semibold">Ambito</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={`${t.scope}-${t.nodeId ?? ''}-${t.id}`} className="border-b border-slate-800/80">
                    <td className="px-3 py-2 text-slate-200">{t.name}</td>
                    <td className="px-3 py-2 font-mono text-slate-400">{t.httpMethod || '—'}</td>
                    <td className="max-w-[240px] truncate px-3 py-2 font-mono text-[10px] text-slate-500">
                      {t.url || '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{scopeLabel(t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Dettaglio
          </h3>
          <ul className="space-y-1.5">
            {rows.map((t) => (
              <ElevenLabsToolListRow
                key={`card-${t.scope}-${t.nodeId ?? ''}-${t.id}`}
                tool={t}
                inherited={t.scope === 'agent'}
              />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
