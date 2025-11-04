import React, { useMemo } from 'react';
import ItemListEditor from '../../../../components/common/ItemListEditor';
import type { ListItem } from '../../../../features/intent-editor/ui/common/ListGrid';
import { instanceRepository } from '../../../../services/InstanceRepository';
import { GitBranch } from 'lucide-react';
import type { ProblemIntent } from '../../../../types/project';

export interface IntentListEditorProps {
  instanceId: string;
  actId: string;
  selectedIntentId?: string | null;
  onIntentChange?: (intents: ProblemIntent[]) => void;
  onIntentSelect?: (intentId: string | null) => void;
}

/**
 * Common SSOT component for editing intent list in ResponseEditor
 * Used when act.type === 'ProblemClassification' and kind === 'intent'
 * Manages intents in instanceRepository and syncs with useIntentStore for training
 */
export default function IntentListEditor({
  instanceId,
  actId,
  selectedIntentId,
  onIntentChange,
  onIntentSelect,
}: IntentListEditorProps) {
  // Get current instance
  const instance = useMemo(() => {
    return instanceRepository.getInstance(instanceId);
  }, [instanceId]);

  // Get current intents from instance
  const intents = useMemo(() => {
    return (instance?.problemIntents || []) as ProblemIntent[];
  }, [instance?.problemIntents]);

  // Convert ProblemIntent[] to ListItem[]
  const items: ListItem[] = useMemo(() => {
    return intents.map(intent => ({
      id: intent.id || intent.name,
      label: intent.name,
      meta: {
        threshold: intent.threshold,
        matchingCount: intent.phrases?.matching?.length || 0,
        notMatchingCount: intent.phrases?.notMatching?.length || 0,
        keywordsCount: intent.phrases?.keywords?.length || 0,
      }
    }));
  }, [intents]);

  // Get selected intent ID
  const selectedId = selectedIntentId || null;

  // Handlers
  const handleAdd = (name: string): string => {
    const newIntent: ProblemIntent = {
      id: crypto.randomUUID(),
      name: name.trim(),
      threshold: 0.6,
      phrases: {
        matching: [],
        notMatching: [],
        keywords: [],
      }
    };

    const updatedIntents = [...intents, newIntent];
    instanceRepository.updateIntents(instanceId, updatedIntents);
    onIntentChange?.(updatedIntents);

    return newIntent.id;
  };

  const handleEdit = (id: string, newLabel: string) => {
    const updatedIntents = intents.map(intent =>
      intent.id === id || intent.name === id
        ? { ...intent, name: newLabel.trim() }
        : intent
    );
    instanceRepository.updateIntents(instanceId, updatedIntents);
    onIntentChange?.(updatedIntents);
  };

  const handleDelete = (id: string) => {
    const updatedIntents = intents.filter(intent => intent.id !== id && intent.name !== id);
    instanceRepository.updateIntents(instanceId, updatedIntents);
    onIntentChange?.(updatedIntents);
  };

  const handleImport = (values: string[]) => {
    const newIntents: ProblemIntent[] = values.map(value => ({
      id: crypto.randomUUID(),
      name: value.trim(),
      threshold: 0.6,
      phrases: {
        matching: [],
        notMatching: [],
        keywords: [],
      }
    }));

    const updatedIntents = [...intents, ...newIntents];
    instanceRepository.updateIntents(instanceId, updatedIntents);
    onIntentChange?.(updatedIntents);
  };

  const handleClearAll = () => {
    instanceRepository.updateIntents(instanceId, []);
    onIntentChange?.([]);
  };

  const handleSelect = (id: string) => {
    const newSelectedId = selectedId === id ? null : id; // Toggle selection
    onIntentSelect?.(newSelectedId);
  };

  return (
    <ItemListEditor
      items={items}
      selectedId={selectedId}
      onSelect={handleSelect}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onImport={handleImport}
      onClearAll={handleClearAll}
      title="Intents"
      placeholder="Add or find a problem…"
      addButtonLabel="+"
      LeftIcon={GitBranch}
      labelAddon={(item) => (
        <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700">
          {item.meta?.matchingCount ?? 0}
        </span>
      )}
      importSuccessMessage={(count) => `Importati ${count} intenti`}
      importErrorMessage={{
        clipboard: 'Errore durante la lettura del clipboard',
        file: 'Errore durante la lettura del file',
        empty: 'Nessun valore valido trovato'
      }}
      clearConfirmMessage={(count) => `Sei sicuro di voler rimuovere tutti gli ${count} intenti? Questo rimuoverà anche tutte le frasi associate.`}
    />
  );
}

