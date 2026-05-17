/**
 * Single resolved ConvAI tool row (webhook / client) for workspace tool lists.
 */

import React from 'react';
import type { WorkspaceResolvedTool } from '@workspaces/core/types';
import { BookOpen, CornerDownRight, PlugZap, MessageSquare } from 'lucide-react';

export type ElevenLabsToolListRowProps = {
  tool: WorkspaceResolvedTool;
  /** When true, row is shown under «ereditati dall'agente». */
  inherited?: boolean;
};

function kindLabel(kind: WorkspaceResolvedTool['kind']): string {
  if (kind === 'webhook') return 'webhook';
  if (kind === 'client') return 'client';
  if (kind === 'api_integration_webhook') return 'integrazione';
  return kind;
}

function ToolIcon({
  tool,
  inherited,
}: {
  tool: WorkspaceResolvedTool;
  inherited?: boolean;
}): React.ReactElement {
  if (inherited) {
    return <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-violet-400" aria-hidden />;
  }
  if (tool.kind === 'webhook' || tool.kind === 'api_integration_webhook') {
    return <BookOpen className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden />;
  }
  if (tool.kind === 'client') {
    return <MessageSquare className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />;
  }
  return <PlugZap className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />;
}

export function ElevenLabsToolListRow({
  tool,
  inherited = false,
}: ElevenLabsToolListRowProps): React.ReactElement {
  const subtitle = [tool.httpMethod, tool.url].filter(Boolean).join(' · ');
  return (
    <li
      className="flex items-start gap-2 rounded-md border border-slate-700/60 bg-slate-900/50 px-2.5 py-2 text-xs"
      title={tool.url || tool.description || tool.name}
    >
      <ToolIcon tool={tool} inherited={inherited} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-slate-200">{tool.name}</span>
          <span className="rounded bg-slate-800 px-1 py-0.5 text-[10px] uppercase text-slate-500">
            {kindLabel(tool.kind)}
          </span>
        </span>
        {subtitle ? (
          <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-500">{subtitle}</span>
        ) : (
          <span className="mt-0.5 block font-mono text-[10px] text-slate-600">{tool.id}</span>
        )}
      </span>
    </li>
  );
}
