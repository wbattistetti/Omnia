/**
 * ConvAI tool row as backend accordion: header = BookOpen + name; body = URL + OpenAPI SEND/RECEIVE.
 */

import React from 'react';
import type { WorkspaceResolvedTool } from '@workspaces/core/types';
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { deriveBackendLabelFromUrl } from '@domain/backendCatalog';
import { ElevenLabsToolBackendSignaturePanel } from './ElevenLabsToolBackendSignaturePanel';

export type ElevenLabsToolListRowProps = {
  tool: WorkspaceResolvedTool;
  /** When true, row is shown under «ereditati dall'agente». */
  inherited?: boolean;
};

function toolHasEndpoint(tool: WorkspaceResolvedTool): boolean {
  return Boolean(tool.url?.trim());
}

function backendDisplayName(tool: WorkspaceResolvedTool): string {
  const fromUrl = deriveBackendLabelFromUrl(tool.url ?? '');
  const fromName = tool.name.trim();
  return fromUrl || fromName || tool.id;
}

function sanitizeListIdPrefix(id: string): string {
  return `elws-${id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)}`;
}

function normalizeMethod(m: string | undefined): string {
  const u = (m || 'GET').trim().toUpperCase();
  if (u === 'GET' || u === 'POST' || u === 'PUT' || u === 'DELETE' || u === 'PATCH') return u;
  return 'GET';
}

export function ElevenLabsToolListRow({
  tool,
}: ElevenLabsToolListRowProps): React.ReactElement {
  const hasEndpoint = toolHasEndpoint(tool);
  const [expanded, setExpanded] = React.useState(false);
  const backendName = backendDisplayName(tool);
  const url = tool.url?.trim() ?? '';
  const method = normalizeMethod(tool.httpMethod);

  const toggle = () => {
    if (!hasEndpoint) return;
    setExpanded((v) => !v);
  };

  if (!hasEndpoint) {
    return (
      <li
        className="flex items-center gap-2 rounded-lg border border-slate-700/55 bg-slate-950/35 px-2.5 py-2 text-xs"
        title={tool.description || tool.name}
      >
        <BookOpen className="h-4 w-4 shrink-0 text-violet-300/90" aria-hidden />
        <span className="min-w-0 truncate font-medium text-amber-100/90">{backendName}</span>
      </li>
    );
  }

  const accordionFrame = 'overflow-hidden rounded-lg border border-slate-700/55 bg-slate-950/35';
  const accordionRoot = `grid min-h-0 grid-cols-1 ${accordionFrame} ${
    expanded ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-rows-[auto_minmax(0,0fr)]'
  }`;

  return (
    <li className={accordionRoot} title={url}>
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-2 border-b border-slate-800/65 bg-slate-950/50 px-2 py-2 text-left text-xs hover:bg-slate-900/60"
        onClick={toggle}
        aria-expanded={expanded}
        aria-label={expanded ? `Comprimi ${backendName}` : `Espandi ${backendName}`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center text-slate-400">
          {expanded ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
        </span>
        <BookOpen className="h-4 w-4 shrink-0 text-violet-300/90" aria-hidden />
        <span className="min-w-0 truncate font-medium text-amber-100/90">{backendName}</span>
      </button>

      <div className="min-h-0 overflow-hidden">
        {expanded ? (
          <div className="space-y-2 border-t border-slate-800/50 px-2.5 py-2.5">
            <p className="break-all font-mono text-[11px] leading-relaxed text-slate-400">
              <span className="font-semibold text-violet-200/90">{method}</span>
              <span className="text-slate-600"> · </span>
              <span className="text-amber-100/80">{url}</span>
            </p>
            <ElevenLabsToolBackendSignaturePanel
              operationalUrl={url}
              httpMethod={tool.httpMethod}
              listIdPrefix={sanitizeListIdPrefix(tool.id)}
              active
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}
