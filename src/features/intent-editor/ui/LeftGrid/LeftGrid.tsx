import React, { useState, useMemo, useCallback } from 'react';
import { useIntentStore } from '../../state/intentStore';
import ListGrid from '../common/ListGrid';
import { GitBranch, Trash2, CheckSquare2, Square, Loader2, Wand2, Eye, EyeOff } from 'lucide-react';
import { ImportDropdown } from '../common/ImportDropdown';
import { InlineConfirmBar } from '@components/common/InlineConfirmBar';
import { IntentDescriptionCell } from './IntentDescriptionCell';
import { generateTrainingPhrasesForIntent } from '../../services/generateTrainingPhrasesService';

export function LeftGrid() {
  const intents = useIntentStore(s => s.intents);
  const selectedId = useIntentStore(s => s.selectedId);
  const select = useIntentStore(s => s.select);
  const addOrFocusIntent = useIntentStore(s => s.addOrFocusIntent);
  const rename = useIntentStore(s => s.renameIntent);
  const remove = useIntentStore(s => s.removeIntent);
  const toggleEnabled = useIntentStore(s => s.toggleIntentEnabled);
  const setIntentDescription = useIntentStore(s => s.setIntentDescription);
  const addCuratedMany = useIntentStore(s => s.addCuratedMany);

  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  /** Descriptions row hidden by default; eye toggles; also set true when generate blocked by missing descriptions */
  const [showDescriptions, setShowDescriptions] = useState(false);
  const [generatingById, setGeneratingById] = useState<Record<string, boolean>>({});

  const allDescriptionsPresent = useMemo(
    () => intents.length > 0 && intents.every(it => (it.description || '').trim().length > 0),
    [intents],
  );

  const isGeneratingPhrases = Object.keys(generatingById).length > 0;

  const handleGenerateTrainingPhrases = useCallback(async () => {
    if (intents.length === 0) return;
    if (!allDescriptionsPresent) {
      setShowDescriptions(true);
      return;
    }
    const list = useIntentStore.getState().intents.filter(it => (it.description || '').trim());
    await Promise.all(
      list.map(async it => {
        const desc = (it.description || '').trim();
        setGeneratingById(g => ({ ...g, [it.id]: true }));
        try {
          const phrases = await generateTrainingPhrasesForIntent({
            intentName: it.name,
            description: desc,
            lang: 'it',
            count: 8,
          });
          addCuratedMany(it.id, phrases, 'it');
        } catch (err) {
          console.error('[LeftGrid][GeneratePhrases]', err);
          window.alert(err instanceof Error ? err.message : 'Phrase generation failed');
        } finally {
          setGeneratingById(g => {
            const n = { ...g };
            delete n[it.id];
            return n;
          });
        }
      }),
    );
  }, [allDescriptionsPresent, addCuratedMany, intents.length]);

  const items = intents.map(i => ({
    id: i.id,
    label: i.name,
    meta: {
      pos: i.variants.curated.length,
      neg: i.variants.hardNeg.length,
      key: (i.signals.keywords || []).length,
      enabled: i.enabled !== false,
      description: i.description,
    },
  }));

  const handleImportIntents = (values: string[]) => {
    values.forEach(value => {
      addOrFocusIntent(value, ['it']);
    });
  };

  const handleClearAllClick = () => {
    if (intents.length === 0) return;
    setShowClearAllConfirm(true);
  };

  const handleConfirmClearAll = () => {
    setShowClearAllConfirm(false);
    const ids = intents.map(i => i.id);
    ids.forEach(id => remove(id));
  };

  const handleSelectAll = () => {
    intents.forEach(intent => {
      if (intent.enabled === false) {
        toggleEnabled(intent.id);
      }
    });
  };

  const handleDeselectAll = () => {
    intents.forEach(intent => {
      if (intent.enabled !== false) {
        toggleEnabled(intent.id);
      }
    });
  };

  const wandTitle = allDescriptionsPresent
    ? 'Generate training phrases'
    : 'Per generare frasi di training servono descrizioni per tutti gli intent — clicca per mostrare le descrizioni';

  return (
    <div className="border border-amber-300 rounded-2xl overflow-hidden shadow-sm flex flex-col flex-1 min-h-0">
      <div className="relative z-10 px-3 py-2 bg-amber-200 text-slate-900 font-semibold border-b flex flex-wrap items-center justify-between gap-y-2">
        <span className="shrink-0">Intents</span>
        <div className="flex flex-wrap items-center justify-end gap-2 min-w-0">
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={intents.length === 0}
            className="p-1.5 rounded border bg-white hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Seleziona tutto"
          >
            <CheckSquare2 size={16} />
          </button>
          <button
            type="button"
            onClick={handleDeselectAll}
            disabled={intents.length === 0}
            className="p-1.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Deseleziona tutto"
          >
            <Square size={16} />
          </button>
          <button
            type="button"
            onClick={() => setShowDescriptions(v => !v)}
            className={`p-1.5 rounded border bg-white flex items-center justify-center ${
              showDescriptions ? 'border-violet-400 text-violet-700 bg-violet-50' : 'hover:bg-slate-50 text-slate-600'
            }`}
            title={showDescriptions ? 'Nascondi descrizioni intent' : 'Mostra descrizioni intent'}
            aria-pressed={showDescriptions}
          >
            {showDescriptions ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <ImportDropdown
            onImport={handleImportIntents}
            iconOnly
            buttonLabel="Import intenti"
            successMessage={(count) => `Importati ${count} intenti`}
            errorMessage={{
              clipboard: 'Errore durante la lettura del clipboard',
              file: 'Errore durante la lettura del file',
              empty: 'Nessun valore valido trovato',
            }}
          />
          <button
            type="button"
            onClick={handleGenerateTrainingPhrases}
            disabled={intents.length === 0 || isGeneratingPhrases}
            className={`p-1.5 rounded-lg border flex items-center justify-center transition-colors ${
              allDescriptionsPresent && intents.length > 0
                ? 'border-slate-300 bg-white text-violet-700 hover:bg-violet-50'
                : 'border-red-400 bg-red-50 text-red-600 hover:bg-red-100'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={wandTitle}
          >
            {isGeneratingPhrases ? (
              <Loader2 size={16} className="animate-spin text-amber-600" />
            ) : (
              <Wand2 size={16} />
            )}
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleClearAllClick}
              disabled={intents.length === 0 || showClearAllConfirm}
              className="p-1.5 rounded border bg-white hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Clear All Intents"
            >
              <Trash2 size={16} />
            </button>
            {showClearAllConfirm && (
              <InlineConfirmBar
                message={
                  <>
                    Rimuovere tutti gli <strong>{intents.length}</strong> intenti? Anche le frasi associate.
                  </>
                }
                onConfirm={handleConfirmClearAll}
                onCancel={() => setShowClearAllConfirm(false)}
              />
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ListGrid
          truncateLabels={false}
          items={items}
          selectedId={selectedId}
          onSelect={select}
          placeholder="Add or find a problem…"
          addButtonLabel="+"
          highlightedId={highlightedId}
          onEnterAdd={(name) => {
            const id = addOrFocusIntent(name, ['it']);
            select(id);
            setHighlightedId(id);
            setTimeout(() => {
              const element = document.querySelector(`[data-item-id="${id}"]`) as HTMLElement;
              if (element) {
                element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }
            }, 50);
            setTimeout(() => {
              setHighlightedId(null);
            }, 2000);
          }}
          LeftIcon={GitBranch}
          sort="alpha"
          labelAddon={item => (
            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700">
              {item.meta?.pos ?? 0}
            </span>
          )}
          rightSlot={item =>
            generatingById[item.id] ? (
              <Loader2 className="animate-spin shrink-0 text-amber-600" size={14} aria-label="Generating" />
            ) : null
          }
          rowFooter={
            showDescriptions
              ? item => (
                  <IntentDescriptionCell
                    intentId={item.id}
                    description={item.meta?.description as string | undefined}
                    onSave={(id, next) => setIntentDescription(id, next)}
                  />
                )
              : undefined
          }
          itemEnabled={item => item.meta?.enabled !== false}
          onToggleEnabled={toggleEnabled}
          onEditItem={(id, newLabel) => rename(id, newLabel)}
          onDeleteItem={id => remove(id)}
        />
      </div>
    </div>
  );
}
