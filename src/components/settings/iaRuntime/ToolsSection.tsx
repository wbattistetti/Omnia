/**
 * Definizioni tool (nome, descrizione, JSON schema) — pannello Developer Tools.
 */

import type { ToolDefinition } from 'types/iaAgentRuntimeSetup';
import { FieldHint } from './FieldHint';

export interface ToolsSectionProps {
  tools: ToolDefinition[];
  showOverrideBadge?: boolean;
  onChange: (tools: ToolDefinition[]) => void;
}

function parseSchema(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed) as unknown;
  if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  throw new Error('inputSchema must be a JSON object');
}

export function ToolsSection({ tools, showOverrideBadge, onChange }: ToolsSectionProps) {
  const updateAt = (index: number, patch: Partial<ToolDefinition>) => {
    const next = tools.map((t, i) => (i === index ? { ...t, ...patch } : t));
    onChange(next);
  };

  const removeAt = (index: number) => {
    onChange(tools.filter((_, i) => i !== index));
  };

  const addTool = () => {
    onChange([
      ...tools,
      {
        name: `tool_${tools.length + 1}`,
        description: '',
        inputSchema: { type: 'object', properties: {} },
      },
    ]);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-row flex-wrap items-center gap-1">
        <span className="text-[10px] font-semibold uppercase leading-none tracking-wide text-slate-400">
          Tools
        </span>
        {showOverrideBadge ? (
          <span className="rounded border border-amber-500/35 bg-amber-500/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-amber-200">
            override
          </span>
        ) : null}
      </div>
      {tools.map((t, idx) => (
        <div
          key={`${t.name}-${idx}`}
          className="rounded border border-slate-700/90 bg-slate-950/80 px-1.5 py-1"
        >
          <div className="flex justify-end">
            <button
              type="button"
              className="text-[10px] leading-none text-red-400 hover:text-red-300"
              onClick={() => removeAt(idx)}
            >
              ×
            </button>
          </div>
          <div className="flex flex-row flex-wrap items-end gap-x-2 gap-y-1">
            <FieldHint label="Nome" tooltip="Nome funzione esposta al modello." className="min-w-0 shrink">
              <input
                className="h-8 max-w-[140px] rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-[11px] leading-none text-slate-100"
                value={t.name}
                onChange={(e) => updateAt(idx, { name: e.target.value })}
              />
            </FieldHint>
            <FieldHint
              label="Descrizione"
              tooltip="Descrizione visibile al modello per scegliere quando chiamare il tool."
              className="min-w-0 shrink"
            >
              <input
                className="h-8 max-w-[180px] rounded border border-slate-600 bg-slate-950 px-1 py-0.5 text-[11px] leading-none text-slate-100"
                value={t.description}
                onChange={(e) => updateAt(idx, { description: e.target.value })}
              />
            </FieldHint>
            <div className="basis-full">
              <FieldHint label="inputSchema (JSON)" tooltip="Schema parametri secondo JSON Schema (oggetto).">
                <textarea
                  className="max-w-[min(100%,280px)] min-h-[56px] resize-y rounded border border-slate-600 bg-slate-950 px-1 py-0.5 font-mono text-[10px] leading-snug text-slate-100"
                  value={JSON.stringify(t.inputSchema, null, 2)}
                  onChange={(e) => {
                    try {
                      const schema = parseSchema(e.target.value);
                      updateAt(idx, { inputSchema: schema });
                    } catch {
                      /* keep editing until valid */
                    }
                  }}
                />
              </FieldHint>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="h-7 w-fit rounded border border-slate-600 bg-slate-800 px-1.5 py-0 text-[10px] leading-none text-slate-100 hover:bg-slate-700"
        onClick={addTool}
      >
        Aggiungi tool
      </button>
    </div>
  );
}
