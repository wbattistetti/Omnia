import React, { useState, useRef } from 'react';
import { Download } from 'lucide-react';

type ImportDropdownProps = {
  onImport: (values: string[]) => void;
  buttonLabel?: string;
  acceptFileType?: string;
  successMessage?: (count: number) => string;
  errorMessage?: {
    clipboard?: string;
    file?: string;
    empty?: string;
  };
};

// Parse values from text (one per riga, rimuove linee vuote)
const parseValues = (text: string): string[] => {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
};

export function ImportDropdown({
  onImport,
  buttonLabel = 'Import Values',
  acceptFileType = '.txt,text/plain',
  successMessage = (count) => `Importati ${count} valori`,
  errorMessage = {
    clipboard: 'Errore durante la lettura del clipboard',
    file: 'Errore durante la lettura del file',
    empty: 'Nessun valore valido trovato'
  }
}: ImportDropdownProps) {
  const [showMenu, setShowMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const values = parseValues(text);
      if (values.length === 0) {
        alert(errorMessage.empty);
        return;
      }
      onImport(values);
      setShowMenu(false);
      alert(successMessage(values.length));
    } catch (err) {
      console.error('Errore lettura clipboard:', err);
      alert(errorMessage.clipboard);
    }
  };

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
      const values = parseValues(text);
      if (values.length === 0) {
        alert(errorMessage.empty);
        return;
      }
      onImport(values);
      setShowMenu(false);
      alert(successMessage(values.length));
    };
    reader.onerror = () => {
      alert(errorMessage.file);
    };
    reader.readAsText(file);

    // Reset input per permettere di selezionare lo stesso file di nuovo
    e.target.value = '';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="px-2 py-1 rounded border bg-white hover:bg-amber-100 flex items-center gap-1"
        title={buttonLabel}
      >
        <Download size={14} />
        {buttonLabel}
      </button>
      {showMenu && (
        <>
          {/* Backdrop per chiudere il menu */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          {/* Menu */}
          <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg z-20 min-w-[180px]">
            <button
              onClick={handleImportFromClipboard}
              className="w-full text-left px-3 py-2 hover:bg-amber-50 rounded-t-lg"
            >
              📋 Da Clipboard
            </button>
            <button
              onClick={handleImportFromFile}
              className="w-full text-left px-3 py-2 hover:bg-amber-50 rounded-b-lg border-t"
            >
              📁 Da File
            </button>
          </div>
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptFileType}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  );
}

