/**
 * Editable table of LLM-proposed fields: label with hover edit/delete; type beside label (orange, edit via pencil).
 */

import React from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import type { AIAgentProposedVariable } from '@types/aiAgentDesign';
import { DATA_ENTITY_TYPES, normalizeEntityType } from '@types/dataEntityTypes';

export interface AIAgentProposedFieldsTableProps {
  fields: AIAgentProposedVariable[];
  /** Kept for callers; linkage is no longer shown under each row. */
  outputVariableMappings: Record<string, string>;
  onUpdateField: (fieldName: string, patch: Partial<AIAgentProposedVariable>) => void;
  onRemoveField: (fieldName: string) => void;
  onLabelBlur: (fieldName: string, labelTrimmed: string) => void;
}

function typeLabelIt(typeId: string): string {
  const n = normalizeEntityType(typeId);
  return DATA_ENTITY_TYPES.find((t) => t.id === n)?.labelIt ?? n;
}

/**
 * Orange read-only type label; pencil on hover opens native select (arrow visible only while editing).
 */
function TypeCell({
  typeId,
  onChange,
  disabled,
}: {
  typeId: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const selectRef = React.useRef<HTMLSelectElement>(null);
  const normalized = normalizeEntityType(typeId);
  const label = typeLabelIt(normalized);

  React.useEffect(() => {
    if (editing) {
      selectRef.current?.focus();
    }
  }, [editing]);

  if (editing) {
    return (
      <select
        ref={selectRef}
        className="max-w-[220px] shrink-0 rounded bg-slate-950 border border-orange-500/50 px-2 py-1 text-sm text-orange-200"
        value={normalized}
        disabled={disabled}
        onChange={(e) => {
          onChange(normalizeEntityType(e.target.value));
          setEditing(false);
        }}
        onBlur={() => setEditing(false)}
      >
        {DATA_ENTITY_TYPES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.labelIt}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <span className="text-sm text-orange-300 whitespace-nowrap">{label}</span>
      {!disabled ? (
        <button
          type="button"
          className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 text-orange-400/90 hover:text-orange-200 hover:bg-slate-800/80 transition-opacity"
          title="Cambia tipo"
          onClick={() => setEditing(true)}
        >
          <Pencil size={13} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function LabelCell({
  label,
  onSave,
  onRemove,
  afterLabel,
}: {
  label: string;
  onSave: (next: string) => void;
  onRemove: () => void;
  afterLabel?: React.ReactNode;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(label);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!editing) setDraft(label);
  }, [label, editing]);

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = React.useCallback(() => {
    const t = draft.trim();
    onSave(t);
    setEditing(false);
  }, [draft, onSave]);

  const cancel = React.useCallback(() => {
    setDraft(label);
    setEditing(false);
  }, [label]);

  React.useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, cancel]);

  return (
    <div className="group relative flex flex-wrap items-center gap-x-2 gap-y-1 min-h-[36px] min-w-0">
      {editing ? (
        <div className="flex w-full min-w-0 items-center gap-1">
          <input
            ref={inputRef}
            className="flex-1 min-w-0 rounded bg-slate-950 border border-violet-600/60 px-2 py-1.5 text-sm text-slate-100"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
            }}
          />
          <button
            type="button"
            className="shrink-0 p-1 rounded text-emerald-400 hover:bg-slate-800"
            title="Conferma"
            onClick={() => commit()}
          >
            <Check size={16} aria-hidden />
          </button>
          <button
            type="button"
            className="shrink-0 p-1 rounded text-slate-400 hover:bg-slate-800"
            title="Annulla"
            onClick={() => cancel()}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      ) : (
        <>
          <span className="min-w-0 text-sm text-slate-200 break-words py-0.5">{label || '—'}</span>
          {afterLabel}
          <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              className="p-1 rounded text-slate-400 hover:text-violet-300 hover:bg-slate-800"
              title="Modifica nome"
              onClick={() => setEditing(true)}
            >
              <Pencil size={14} aria-hidden />
            </button>
            <button
              type="button"
              className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"
              title="Rimuovi variabile"
              onClick={() => onRemove()}
            >
              <Trash2 size={14} aria-hidden />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function AIAgentProposedFieldsTable({
  fields,
  outputVariableMappings: _outputVariableMappings,
  onUpdateField,
  onRemoveField,
  onLabelBlur,
}: AIAgentProposedFieldsTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-800">
      <table className="w-full text-sm border-collapse">
        <tbody>
          {fields.map((f) => (
            <tr key={f.field_name} className="align-middle">
              <td className="w-[52px] p-2 align-middle text-center">
                <input
                  type="checkbox"
                  className="rounded border-slate-600 align-middle"
                  checked={f.required}
                  onChange={(e) => onUpdateField(f.field_name, { required: e.target.checked })}
                  title="Obbligatorio"
                  aria-label="Obbligatorio"
                />
              </td>
              <td className="p-2 align-middle min-w-0">
                <LabelCell
                  label={f.label}
                  onSave={(next) => {
                    onUpdateField(f.field_name, { label: next });
                    onLabelBlur(f.field_name, next.trim());
                  }}
                  onRemove={() => onRemoveField(f.field_name)}
                  afterLabel={
                    <TypeCell
                      typeId={f.type}
                      onChange={(next) => onUpdateField(f.field_name, { type: next })}
                    />
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
