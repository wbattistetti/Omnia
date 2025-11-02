import React, { useState, useRef } from 'react';
import { useIntentStore } from '../../state/intentStore';
import ListGrid from '../common/ListGrid';
import { GitBranch, Download, Trash2, CheckSquare2, Square } from 'lucide-react';

export function LeftGrid(){
  const intents = useIntentStore(s=>s.intents);
  const selectedId = useIntentStore(s=>s.selectedId);
  const select = useIntentStore(s=>s.select);
  const addOrFocusIntent = useIntentStore(s=>s.addOrFocusIntent);
  const rename = useIntentStore(s=>s.renameIntent);
  const remove = useIntentStore(s=>s.removeIntent);
  const toggleEnabled = useIntentStore(s=>s.toggleIntentEnabled); // ✅ Nuovo hook
  const [showImportMenu, setShowImportMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const items = intents.map(i=>({
    id: i.id,
    label: i.name,
    meta: {
      pos: i.variants.curated.length,
      neg: i.variants.hardNeg.length,
      key: (i.signals.keywords || []).length,
      enabled: i.enabled !== false, // ✅ Passa lo stato enabled nel meta
    }
  }));

  // Parse intent values from text (one per riga, rimuove linee vuote)
  const parseIntentValues = (text: string): string[] => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  };

  // Import from clipboard
  const handleImportFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const values = parseIntentValues(text);
      if (values.length === 0) {
        alert('Nessun valore valido trovato nel clipboard');
        return;
      }
      // Aggiungi tutti gli intenti
      values.forEach(value => {
        addOrFocusIntent(value, ['it']);
      });
      setShowImportMenu(false);
      alert(`Importati ${values.length} intenti dal clipboard`);
    } catch (err) {
      console.error('Errore lettura clipboard:', err);
      alert('Errore durante la lettura del clipboard');
    }
  };

  // Import from file
  const handleImportFromFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verifica che sia un file di testo
    if (!file.name.endsWith('.txt') && !file.type.startsWith('text/')) {
      alert('Seleziona un file di testo (.txt)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const values = parseIntentValues(text);
      if (values.length === 0) {
        alert('Nessun valore valido trovato nel file');
        return;
      }
      // Aggiungi tutti gli intenti
      values.forEach(value => {
        addOrFocusIntent(value, ['it']);
      });
      setShowImportMenu(false);
      alert(`Importati ${values.length} intenti dal file`);
    };
    reader.onerror = () => {
      alert('Errore durante la lettura del file');
    };
    reader.readAsText(file);

    // Reset input per permettere di selezionare lo stesso file di nuovo
    e.target.value = '';
  };

  // Clear all intents (rimuove anche tutte le frasi associate automaticamente)
  const handleClearAll = () => {
    if (intents.length === 0) return;
    if (!confirm(`Sei sicuro di voler rimuovere tutti gli ${intents.length} intenti? Questo rimuoverà anche tutte le frasi associate.`)) {
      return;
    }
    // Rimuovi tutti gli intenti (le frasi vengono rimosse automaticamente perché sono contenute negli intenti)
    intents.forEach(intent => remove(intent.id));
  };

  // ✅ Seleziona tutto (abilita tutti gli intenti)
  const handleSelectAll = () => {
    intents.forEach(intent => {
      if (intent.enabled === false) {
        toggleEnabled(intent.id);
      }
    });
  };

  // ✅ Deseleziona tutto (disabilita tutti gli intenti)
  const handleDeselectAll = () => {
    intents.forEach(intent => {
      if (intent.enabled !== false) {
        toggleEnabled(intent.id);
      }
    });
  };

  return (
    <div className="border border-amber-300 rounded-2xl overflow-hidden shadow-sm flex flex-col h-full min-h-0">
      <div className="px-3 py-2 bg-amber-200 text-slate-900 text-sm font-semibold border-b flex items-center justify-between">
        <span>Intents</span>
        <div className="flex items-center gap-2">
          {/* ✅ Pulsanti Seleziona/Deseleziona tutto - solo icone */}
          <button
            onClick={handleSelectAll}
            disabled={intents.length === 0}
            className="p-1.5 rounded border bg-white hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Seleziona tutto"
          >
            <CheckSquare2 size={16} />
          </button>
          <button
            onClick={handleDeselectAll}
            disabled={intents.length === 0}
            className="p-1.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Deseleziona tutto"
          >
            <Square size={16} />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowImportMenu(!showImportMenu)}
              className="px-2 py-1 text-xs rounded border bg-white hover:bg-amber-100 flex items-center gap-1"
              title="Import Values"
            >
              <Download size={14} />
              Import Values
            </button>
          {showImportMenu && (
            <>
              {/* Backdrop per chiudere il menu */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowImportMenu(false)}
              />
              {/* Menu */}
              <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg z-20 min-w-[180px]">
                <button
                  onClick={handleImportFromClipboard}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 rounded-t-lg"
                >
                  📋 Da Clipboard
                </button>
                <button
                  onClick={handleImportFromFile}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 rounded-b-lg border-t"
                >
                  📁 Da File
                </button>
              </div>
            </>
          )}
          </div>
          {/* ✅ Pulsante Clear per rimuovere tutti gli intenti - solo icona */}
          <button
            onClick={handleClearAll}
            disabled={intents.length === 0}
            className="p-1.5 rounded border bg-white hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear All Intents"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {/* ✅ Container per ListGrid con altezza definita per permettere scroll interno */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,text/plain"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <ListGrid
          items={items}
          selectedId={selectedId}
          onSelect={select}
          placeholder="Add or find a problem…"
          addButtonLabel="+"
          highlightedId={highlightedId}
          onEnterAdd={(name) => {
            const id = addOrFocusIntent(name, ['it']);
            select(id);
            // ✅ Evidenzia l'intento appena aggiunto con sfondo pastello
            setHighlightedId(id);
            // ✅ Scrolla l'intento nella vista dopo un breve delay per permettere il re-render
            setTimeout(() => {
              // ListGrid gestisce già lo scroll, ma assicuriamoci che sia visibile
              const element = document.querySelector(`[data-item-id="${id}"]`) as HTMLElement;
              if (element) {
                element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }
            }, 50);
            // ✅ Rimuovi l'highlight dopo 2 secondi
            setTimeout(() => {
              setHighlightedId(null);
            }, 2000);
          }}
          LeftIcon={GitBranch}
          sort="alpha"
          labelAddon={(item)=> (
            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700">{item.meta?.pos ?? 0}</span>
          )}
          rightSlot={() => null}
          itemEnabled={(item) => item.meta?.enabled !== false} // ✅ Passa funzione per controllare enabled
          onToggleEnabled={toggleEnabled} // ✅ Passa handler per toggle
          onEditItem={(id, newLabel)=> rename(id, newLabel)}
          onDeleteItem={(id)=> remove(id)}
        />
      </div>
    </div>
  );
}


