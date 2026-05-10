import React from 'react';
import { X } from 'lucide-react';
import { UseCasesPanelIcon } from '../ui/UseCaseIcons';
import {
  type UseCaseGlobalStyleId,
  USE_CASE_GLOBAL_STYLES,
} from '../ui/useCaseGlobalStyles';

/**
 * Toolbar for use-case editor panel.
 */
export function UseCaseToolbar({
  globalStyleId,
  onGlobalStyleIdChange,
  onClosePanel,
}: {
  globalStyleId: UseCaseGlobalStyleId;
  onGlobalStyleIdChange: (styleId: UseCaseGlobalStyleId) => void;
  onClosePanel: () => void;
}) {
  return (
    <div className="px-2 py-2 border-b border-cyan-600/70 bg-cyan-900/55 flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-cyan-100">
        <UseCasesPanelIcon size={14} className="text-cyan-100" />
        <span>Usecases</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <label htmlFor="debugger-use-case-global-style" className="text-xs text-cyan-100">
          Stile globale
        </label>
        <select
          id="debugger-use-case-global-style"
          value={globalStyleId}
          onChange={(e) => onGlobalStyleIdChange(e.target.value as UseCaseGlobalStyleId)}
          className="rounded border border-cyan-500/50 bg-slate-900/80 px-2 py-1 text-xs text-cyan-100"
        >
          {USE_CASE_GLOBAL_STYLES.map((style) => (
            <option key={style.id} value={style.id}>
              {style.label}
            </option>
          ))}
        </select>
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

