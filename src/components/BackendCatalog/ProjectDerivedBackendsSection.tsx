/**
 * Elenco read-only dei backend citati dal grafo e dagli agent IA (catalogo derivato).
 * Pensato per il pannello «Dati» dell’editor AI Agent, non per il tab Backends.
 */

import React from 'react';
import { Layers, Box } from 'lucide-react';
import { taskRepository } from '@services/TaskRepository';
import { useProjectData } from '@context/ProjectDataContext';
import {
  buildProjectBackendCatalogView,
  staleReasonForBinding,
  SpecStaleReason,
  type CatalogRow,
} from '@domain/backendCatalog';
import { staleReasonLabel } from '@components/BackendCatalog/catalogStaleLabels';

function StaleChip({ reason }: { reason: SpecStaleReason }) {
  if (reason === SpecStaleReason.FRESH) {
    return (
      <span
        className="rounded bg-emerald-950/80 px-1.5 py-0.5 text-[10px] text-emerald-300"
        title={staleReasonLabel(reason)}
      >
        OK
      </span>
    );
  }
  return (
    <span className="rounded bg-amber-950/80 px-1.5 py-0.5 text-[10px] text-amber-200" title={staleReasonLabel(reason)}>
      Stale
    </span>
  );
}

export function ProjectDerivedBackendsSection() {
  const { data } = useProjectData();
  const [tasksTick, setTasksTick] = React.useState(0);

  React.useEffect(() => {
    const onLoaded = () => setTasksTick((t) => t + 1);
    window.addEventListener('tasks:loaded', onLoaded);
    return () => window.removeEventListener('tasks:loaded', onLoaded);
  }, []);

  const derivedOnly = React.useMemo(() => {
    const manual = data?.backendCatalog?.manualEntries ?? [];
    const { rows } = buildProjectBackendCatalogView(taskRepository.getAllTasks(), manual);
    return rows.filter((r: CatalogRow) => r.sources.graph || r.sources.tools);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tasksTick dopo tasks:loaded
  }, [data?.backendCatalog?.manualEntries, tasksTick]);

  if (derivedOnly.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-slate-800/80 pt-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Dal grafo e dagli agent
      </h3>
      <ul className="space-y-1.5">
        {derivedOnly.map((row) => (
          <li key={row.key} className="rounded-md border border-slate-800 bg-slate-900/40 px-2 py-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="text-[11px] font-medium text-slate-200">{row.label}</span>
              <span className="flex gap-1">
                {row.sources.graph && (
                  <span className="rounded bg-slate-700/80 px-1 py-0.5 text-[9px] text-slate-300">
                    <Layers className="inline h-3 w-3" /> Grafo
                  </span>
                )}
                {row.sources.tools && (
                  <span className="rounded bg-violet-900/50 px-1 py-0.5 text-[9px] text-violet-200">
                    <Box className="inline h-3 w-3" /> Agent
                  </span>
                )}
              </span>
            </div>
            <div className="font-mono text-[10px] text-slate-500 truncate">
              {row.method} {row.pathnameDisplay}
            </div>
            <ul className="mt-1 space-y-0.5 border-t border-slate-800/60 pt-1">
              {row.bindings
                .filter((b) => b.source !== 'manual')
                .map((b) => (
                  <li key={b.bindingId} className="flex items-center gap-2 text-[10px] text-slate-500">
                    <code className="truncate">{b.bindingId}</code>
                    <StaleChip reason={staleReasonForBinding(b)} />
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
