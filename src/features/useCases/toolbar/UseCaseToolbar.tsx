import React from 'react';
import { X } from 'lucide-react';
import { UseCasesPanelIcon } from '../ui/UseCaseIcons';

/**
 * Toolbar for use-case editor panel.
 */
export function UseCaseToolbar({
  onCreateUseCase,
  onClosePanel,
}: {
  onCreateUseCase: () => void;
  onClosePanel: () => void;
}) {
  return (
    <div className="px-2 py-2 border-b border-cyan-600/70 bg-cyan-900/55 flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-cyan-100">
        <UseCasesPanelIcon size={14} className="text-cyan-100" />
        <span>Usecases</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onCreateUseCase}
          className="text-xs px-2 py-1 rounded bg-slate-900/80 text-cyan-100 border border-cyan-500/50 hover:bg-slate-800"
        >
          add
        </button>
        <button
          type="button"
          onClick={onClosePanel}
          className="p-1 rounded text-cyan-100 hover:bg-slate-800/80"
          aria-label="Close usecase panel"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

