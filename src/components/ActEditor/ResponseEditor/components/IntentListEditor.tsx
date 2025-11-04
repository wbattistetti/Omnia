import React, { useEffect, useMemo, useState } from 'react';
import ItemListEditor from '../../../../components/common/ItemListEditor';
import type { ListItem } from '../../../../features/intent-editor/ui/common/ListGrid';
import { instanceRepository } from '../../../../services/InstanceRepository';
import { GitBranch } from 'lucide-react';
import type { ProblemIntent } from '../../../../types/project';
import PhrasesDropdown from './PhrasesDropdown';
import { useIntentStore } from '../../../../features/intent-editor/state/intentStore';
import { generateVariantsForIntent } from '../../../../features/intent-editor/services/variantsService';
import { ImportDropdown } from '../../../../features/intent-editor/ui/common/ImportDropdown';

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
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; intentName: string } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Get current instance - force refresh when refreshTrigger changes
  const instance = useMemo(() => {
    return instanceRepository.getInstance(instanceId);
  }, [instanceId, refreshTrigger]);

  // Get current intents from instance
  const intents = useMemo(() => {
    return (instance?.problemIntents || []) as ProblemIntent[];
  }, [instance?.problemIntents]);

  // Listen for instance updates from instanceRepository
  useEffect(() => {
    const handleInstanceUpdate = () => {
      setRefreshTrigger(prev => prev + 1);
    };

    // Listen to custom event emitted by instanceRepository when intents are updated
    window.addEventListener('instanceRepository:updated', handleInstanceUpdate);

    return () => {
      window.removeEventListener('instanceRepository:updated', handleInstanceUpdate);
    };
  }, [instanceId]);

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

  // Handle select all / deselect all
  const handleSelectAll = () => {
    // Select all intents
    const allIds = intents.map(intent => intent.id || intent.name);
    if (allIds.length > 0) {
      // Toggle selection: if all are selected, deselect all; otherwise select all
      const allSelected = allIds.every(id => selectedId === id);
      if (allSelected) {
        onIntentSelect?.(null);
      } else {
        onIntentSelect?.(allIds[0]); // Select first one (or implement multi-select if needed)
      }
    }
  };

  const handleDeselectAll = () => {
    onIntentSelect?.(null);
  };

  // Handle phrases generation (batch for all intents)
  const handleBatchGenerate = async () => {
    if (intents.length === 0) {
      console.warn('[IntentListEditor] No intents available for generation');
      return;
    }

    try {
      // Sync intents from instanceRepository to useIntentStore before generating
      const intentsForStore = intents.map(intent => ({
        id: intent.id,
        name: intent.name,
        langs: ['it'],
        threshold: intent.threshold ?? 0.6,
        status: 'draft' as const,
        enabled: true,
        variants: {
          curated: (intent.phrases?.matching || []).map(p => ({ id: p.id, text: p.text, lang: (p.lang as any) || 'it' })),
          staging: [],
          hardNeg: (intent.phrases?.notMatching || []).map(p => ({ id: p.id, text: p.text, lang: (p.lang as any) || 'it' })),
        },
        signals: { keywords: (intent.phrases?.keywords || []), synonymSets: [], patterns: [] },
      }));
      useIntentStore.setState({ intents: intentsForStore });

      setBatchProgress({ current: 0, total: intents.length, intentName: 'Inizio generazione...' });
      setBatchGenerating(true);
      await new Promise(resolve => setTimeout(resolve, 100));

      const projectLang = (localStorage.getItem('project.lang') as any) || 'pt';
      const store = useIntentStore.getState();

      // Calculate balancing
      let maxExistingPhrases = 0;
      for (const intent of intents) {
        const count = (intent.phrases?.matching || []).length;
        if (count > maxExistingPhrases) {
          maxExistingPhrases = count;
        }
      }
      const genN = 10; // Default number of phrases
      const phrasesForEmpty = maxExistingPhrases > 0 ? maxExistingPhrases + genN : genN;

      let totalGenerated = 0;
      let totalErrors = 0;

      for (let i = 0; i < intents.length; i++) {
        const intent = intents[i];
        setBatchProgress({ current: i + 1, total: intents.length, intentName: intent.name });
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
          const currentCount = (intent.phrases?.matching || []).length;
          const phrasesToGenerate = currentCount === 0 ? phrasesForEmpty : genN;

          const positive = intent.phrases?.matching || [];
          const negative = intent.phrases?.notMatching || [];
          const keywords = intent.phrases?.keywords || [];

          const allExisting = [
            ...positive.map(p => p.text),
            ...negative.map(p => p.text),
            ...keywords.map((k: any) => k.t || k)
          ];

          const generated = await generateVariantsForIntent({
            intentName: intent.name,
            kind: 'positive' as any,
            exclude: allExisting,
            n: phrasesToGenerate,
            lang: projectLang
          });

          // Add to store
          for (const g of generated) {
            store.addCurated(intent.id, g, projectLang);
            totalGenerated++;
          }

          // Sync with instanceRepository
          const updatedStoreIntents = useIntentStore.getState().intents || [];
          const updatedIntents = (instance?.problemIntents || []).map(pi => {
            if (pi.id === intent.id || pi.name === intent.name) {
              const storeIntent = updatedStoreIntents.find(i => i.id === intent.id);
              if (storeIntent) {
                return {
                  ...pi,
                  phrases: {
                    matching: (storeIntent.variants?.curated || []).map(v => ({ id: v.id, text: v.text, lang: v.lang })),
                    notMatching: (storeIntent.variants?.hardNeg || []).map(v => ({ id: v.id, text: v.text, lang: v.lang })),
                    keywords: (storeIntent.signals?.keywords || []),
                  }
                };
              }
            }
            return pi;
          });
          instanceRepository.updateIntents(instanceId, updatedIntents);

          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
          console.error(`[IntentListEditor] Error generating for intent ${intent.name}:`, err);
          totalErrors++;
        }
      }

      // Log completion without alert
      console.log('[IntentListEditor][BATCH_GENERATE][COMPLETE]', {
        totalGenerated,
        totalErrors,
        intentsCount: intents.length
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Errore durante la generazione batch';
      console.error('[IntentListEditor] Batch generation error:', err);
      // Non mostrare alert, solo log
    } finally {
      setBatchGenerating(false);
      setBatchProgress(null);
    }
  };

  // Handle import phrases from file
  const handleImportPhrasesFromFile = async (values: string[]) => {
    if (values.length === 0) {
      alert('Nessuna frase valida trovata nel file');
      return;
    }

    // If an intent is selected, add phrases to it; otherwise add to all intents
    if (selectedId) {
      const intent = intents.find(i => (i.id || i.name) === selectedId);
      if (intent) {
        const updatedIntents = intents.map(i => {
          if ((i.id || i.name) === selectedId) {
            return {
              ...i,
              phrases: {
                ...i.phrases,
                matching: [
                  ...(i.phrases?.matching || []),
                  ...values.map(text => ({ id: crypto.randomUUID(), text, lang: 'it' as any }))
                ]
              }
            };
          }
          return i;
        });
        instanceRepository.updateIntents(instanceId, updatedIntents);
        onIntentChange?.(updatedIntents);
        alert(`Importate ${values.length} frasi per l'intento "${intent.name}"`);
      }
    } else {
      // Add to all intents
      const updatedIntents = intents.map(i => ({
        ...i,
        phrases: {
          ...i.phrases,
          matching: [
            ...(i.phrases?.matching || []),
            ...values.map(text => ({ id: crypto.randomUUID(), text, lang: 'it' as any }))
          ]
        }
      }));
      instanceRepository.updateIntents(instanceId, updatedIntents);
      onIntentChange?.(updatedIntents);
      alert(`Importate ${values.length} frasi per tutti gli ${intents.length} intenti`);
    }
  };

  // Handle import phrases from clipboard
  const handleImportPhrasesFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const values = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      if (values.length === 0) {
        alert('Nessuna frase valida trovata nel clipboard');
        return;
      }

      // If an intent is selected, add phrases to it; otherwise add to all intents
      if (selectedId) {
        const intent = intents.find(i => (i.id || i.name) === selectedId);
        if (intent) {
          const updatedIntents = intents.map(i => {
            if ((i.id || i.name) === selectedId) {
              return {
                ...i,
                phrases: {
                  ...i.phrases,
                  matching: [
                    ...(i.phrases?.matching || []),
                    ...values.map(text => ({ id: crypto.randomUUID(), text, lang: 'it' as any }))
                  ]
                }
              };
            }
            return i;
          });
          instanceRepository.updateIntents(instanceId, updatedIntents);
          onIntentChange?.(updatedIntents);
          alert(`Importate ${values.length} frasi per l'intento "${intent.name}"`);
        }
      } else {
        // Add to all intents
        const updatedIntents = intents.map(i => ({
          ...i,
          phrases: {
            ...i.phrases,
            matching: [
              ...(i.phrases?.matching || []),
              ...values.map(text => ({ id: crypto.randomUUID(), text, lang: 'it' as any }))
            ]
          }
        }));
        instanceRepository.updateIntents(instanceId, updatedIntents);
        onIntentChange?.(updatedIntents);
        alert(`Importate ${values.length} frasi per tutti gli ${intents.length} intenti`);
      }
    } catch (err) {
      console.error('Errore lettura clipboard:', err);
      alert('Errore durante la lettura del clipboard');
    }
  };

  // Check if all intents are enabled (for checkbox state)
  const allEnabled = useMemo(() => {
    return intents.length > 0 && intents.every(intent => intent.threshold !== undefined && intent.threshold >= 0);
  }, [intents]);

  const handleToggleEnabled = (id: string) => {
    const updatedIntents = intents.map(intent =>
      (intent.id === id || intent.name === id)
        ? { ...intent, threshold: intent.threshold === undefined || intent.threshold < 0 ? 0.6 : -1 }
        : intent
    );
    instanceRepository.updateIntents(instanceId, updatedIntents);
    onIntentChange?.(updatedIntents);
  };

  const itemEnabled = (item: ListItem) => {
    const intent = intents.find(i => (i.id || i.name) === item.id);
    return intent ? (intent.threshold !== undefined && intent.threshold >= 0) : true;
  };

  // Phrases dropdown component
  const phrasesDropdown = (
    <PhrasesDropdown
      onImportFromFile={handleImportPhrasesFromFile}
      onImportFromClipboard={handleImportPhrasesFromClipboard}
      onGenerate={handleBatchGenerate}
      generating={batchGenerating}
      disabled={intents.length === 0}
    />
  );

  // Progress bar component (if generating)
  const progressBar = batchGenerating && batchProgress ? (
    <div style={{
      padding: '8px 12px',
      backgroundColor: '#dbeafe',
      borderBottom: '2px solid #3b82f6',
      fontSize: 12
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 600, color: '#1e40af' }}>
          {batchProgress.intentName} ({batchProgress.current}/{batchProgress.total})
        </span>
        <div style={{
          flex: 1,
          height: 6,
          backgroundColor: '#bfdbfe',
          borderRadius: 3,
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${(batchProgress.current / batchProgress.total) * 100}%`,
            height: '100%',
            backgroundColor: '#3b82f6',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
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
        itemEnabled={itemEnabled}
        onToggleEnabled={handleToggleEnabled}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        headerActions={phrasesDropdown}
      />
      {progressBar}
    </>
  );
}

