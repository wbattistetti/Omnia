/**
 * Stesso contenuto funzionale del Response Editor per Backend Call: toolbar inline + BackendCallEditor.
 * Usato nel tab Backends per ogni voce manuale del catalogo (task dedicato con id = voce).
 */

import React from 'react';
import type { Task } from '../../../../../types/taskTypes';
import type { ToolbarButton } from '../../../../../dock/types';
import BackendCallEditor from '../BackendCallEditor';

function InlineToolbarStrip({ buttons }: { buttons: ToolbarButton[] }) {
  const visible = buttons.filter((b) => b.visible !== false);
  if (visible.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 items-center mb-2 pb-2 border-b border-slate-700 shrink-0">
      {visible.map((b, i) => {
        if (b.dropdownItems && b.dropdownItems.length > 0) {
          return (
            <select
              key={i}
              title={b.title}
              aria-label={b.label || 'Azioni'}
              className="rounded border border-slate-600 bg-slate-800 px-1.5 py-1 text-[10px] text-slate-200 max-w-[10rem]"
              defaultValue=""
              onChange={(e) => {
                const idx = Number(e.target.value);
                if (!Number.isNaN(idx) && b.dropdownItems?.[idx]) {
                  b.dropdownItems[idx].onClick();
                }
                e.target.selectedIndex = 0;
              }}
            >
              <option value="" disabled>
                {b.label ?? '⋯'}
              </option>
              {b.dropdownItems.map((d, j) => (
                <option key={j} value={j}>
                  {d.label}
                </option>
              ))}
            </select>
          );
        }
        return (
          <button
            key={i}
            type="button"
            title={b.title}
            disabled={b.disabled}
            onClick={b.onClick}
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-1 text-[10px] ${
              b.active
                ? 'border-emerald-600/70 bg-emerald-950/50 text-emerald-100'
                : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700/80'
            } disabled:opacity-45`}
          >
            {b.icon}
            {b.label ? <span>{b.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function EmbeddedBackendCallEditor({
  task,
  endpointExternalRevision = 0,
}: {
  task: Task;
  /** Allinea lo stato interno quando URL/metodo sono aggiornati dall’header accordion. */
  endpointExternalRevision?: number;
}) {
  const [toolbarButtons, setToolbarButtons] = React.useState<ToolbarButton[]>([]);

  return (
    <div className="flex flex-col min-h-[320px] max-h-[min(70vh,520px)] border border-slate-700/80 rounded-lg bg-slate-900/40 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        <InlineToolbarStrip buttons={toolbarButtons} />
        <BackendCallEditor
          task={task}
          hideHeader
          hideEndpointRow
          endpointExternalRevision={endpointExternalRevision}
          onToolbarUpdate={(btns) => setToolbarButtons(btns)}
        />
      </div>
    </div>
  );
}
