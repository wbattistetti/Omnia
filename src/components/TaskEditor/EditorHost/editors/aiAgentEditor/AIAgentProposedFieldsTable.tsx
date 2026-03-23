/**
 * Editable table of LLM-proposed fields: Omnia label, JSON field_name, type, required.
 */

import React from 'react';
import type { AIAgentProposedVariable } from '@types/aiAgentDesign';
import { DATA_ENTITY_TYPES, normalizeEntityType } from '@types/dataEntityTypes';

export interface AIAgentProposedFieldsTableProps {
  fields: AIAgentProposedVariable[];
  outputVariableMappings: Record<string, string>;
  onUpdateField: (fieldName: string, patch: Partial<AIAgentProposedVariable>) => void;
  onLabelBlur: (fieldName: string, labelTrimmed: string) => void;
}

export function AIAgentProposedFieldsTable({
  fields,
  outputVariableMappings,
  onUpdateField,
  onLabelBlur,
}: AIAgentProposedFieldsTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-slate-400">
          <tr>
            <th className="text-center p-2 font-medium w-[72px]">Obbl.</th>
            <th className="text-left p-2 font-medium min-w-[160px]">Nome variabile (flusso)</th>
            <th className="text-left p-2 font-medium w-[150px]">Tipo</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => {
            const linked = Boolean(outputVariableMappings[f.field_name]);
            return (
              <tr key={f.field_name} className="border-t border-slate-800 align-top">
                <td className="p-2 text-center align-top">
                  <input
                    type="checkbox"
                    className="rounded border-slate-600"
                    checked={f.required}
                    onChange={(e) => onUpdateField(f.field_name, { required: e.target.checked })}
                    title="Obbligatorio"
                  />
                </td>
                <td className="p-2">
                  <input
                    className="w-full rounded bg-slate-950 border border-slate-600 px-2 py-1.5 text-sm"
                    value={f.label}
                    onChange={(e) => onUpdateField(f.field_name, { label: e.target.value })}
                    onBlur={(e) => onLabelBlur(f.field_name, e.target.value.trim())}
                    placeholder="es. Data di nascita"
                  />
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 font-mono">
                    <span title="Chiave nello stato JSON inviato all'LLM (field_name)">
                      JSON: {f.field_name}
                    </span>
                    {linked ? (
                      <span className="text-emerald-600/90">collegata</span>
                    ) : (
                      <span className="text-slate-600">non collegata</span>
                    )}
                  </div>
                </td>
                <td className="p-2">
                  <select
                    className="w-full max-w-[180px] rounded bg-slate-950 border border-slate-600 px-2 py-1.5 text-xs"
                    value={normalizeEntityType(f.type)}
                    onChange={(e) =>
                      onUpdateField(f.field_name, {
                        type: normalizeEntityType(e.target.value),
                      })
                    }
                  >
                    {DATA_ENTITY_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.labelIt}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
