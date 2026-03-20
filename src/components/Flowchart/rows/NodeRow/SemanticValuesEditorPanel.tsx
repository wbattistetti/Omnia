import React from 'react';
import { Tag } from 'lucide-react';
import ItemListEditor from '@components/common/ItemListEditor';
import { taskRepository } from '@services/TaskRepository';
import type { SemanticValue } from '@types/taskTypes';
import type { NodeRowData } from '@types/project';
import {
  getSemanticValuesForRow,
  mutateSemanticValuesForRow,
} from '@utils/semanticValuesRowState';

interface SemanticValuesEditorPanelProps {
  row: NodeRowData;
  updateNodeRows: (mutate: (rows: NodeRowData[]) => NodeRowData[]) => void;
  onClose: () => void;
  onSaved?: () => void;
}

/**
 * Inline editor for closed-domain semantic values.
 * Pre-task: row.meta.semanticValuesDraft; after task exists: task.semanticValues.
 */
export default function SemanticValuesEditorPanel({
  row,
  updateNodeRows,
  onClose,
  onSaved,
}: SemanticValuesEditorPanelProps) {
  const [refreshTick, setRefreshTick] = React.useState(0);
  const task = React.useMemo(() => taskRepository.getTask(row.id), [row.id, refreshTick]);

  const normalized = React.useMemo(() => {
    void task;
    void refreshTick;
    return getSemanticValuesForRow(row);
  }, [row, task, refreshTick]);

  const values = normalized.items;

  const touch = React.useCallback(() => {
    setRefreshTick((v) => v + 1);
    onSaved?.();
  }, [onSaved]);

  const applyMutation = React.useCallback(
    (mutate: (prev: SemanticValue[]) => SemanticValue[] | null) => {
      const ok = mutateSemanticValuesForRow(row.id, updateNodeRows, mutate);
      if (!ok) {
        window.alert('Could not save allowed values. Please try again.');
        return;
      }
      touch();
    },
    [row.id, updateNodeRows, touch]
  );

  return (
    <div
      style={{
        border: '1px solid #334155',
        borderRadius: 8,
        background: 'rgba(15, 23, 42, 0.55)',
        padding: 8,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDownCapture={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
        }
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-slate-300">
          Allowed values (closed semantic domain)
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-xs px-2 py-1 rounded border border-slate-500 bg-slate-700 text-slate-100 hover:bg-slate-600"
            title="Set this collection to nothing (open domain)"
            onClick={() => {
              const confirmed = window.confirm(
                'Set semantic values to nothing? The slot will become an open domain.'
              );
              if (!confirmed) return;
              applyMutation(() => null);
            }}
          >
            Set to Nothing
          </button>
          <button
            type="button"
            className="text-xs px-2 py-1 rounded border border-slate-500 bg-slate-700 text-slate-100 hover:bg-slate-600"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      <div style={{ height: 220 }}>
        <ItemListEditor
          items={values.map((v) => ({ id: v.id, label: v.label }))}
          selectedId={null}
          onSelect={() => {}}
          onAdd={(name: string) => {
            const item: SemanticValue = {
              id: `value_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              label: name,
            };
            applyMutation((prev) => [...prev, item]);
            return item.id;
          }}
          onEdit={(id, newLabel) => {
            applyMutation((prev) => prev.map((v) => (v.id === id ? { ...v, label: newLabel } : v)));
          }}
          onDelete={(id) => {
            applyMutation((prev) => prev.filter((v) => v.id !== id));
          }}
          onImport={(labels) => {
            applyMutation((prev) => {
              const existing = new Set(prev.map((v) => v.label.toLowerCase().trim()));
              const deduped = labels
                .map((x) => x.trim())
                .filter((x) => x.length > 0)
                .filter((x) => !existing.has(x.toLowerCase()));
              if (deduped.length === 0) return prev;
              const imported = deduped.map((label) => ({
                id: `value_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                label,
              }));
              return [...prev, ...imported];
            });
          }}
          onClearAll={() => applyMutation(() => [])}
          title="Values"
          placeholder="Add allowed value..."
          LeftIcon={Tag}
          headerColor="bg-slate-200"
          borderColor="border-slate-300"
        />
      </div>
    </div>
  );
}
