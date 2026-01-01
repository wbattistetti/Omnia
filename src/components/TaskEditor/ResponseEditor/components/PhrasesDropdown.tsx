import React, { useState, useRef } from 'react';
import { MessageSquare, Download, Sparkles, Loader2 } from 'lucide-react';

interface PhrasesDropdownProps {
  onImportFromFile: (values: string[]) => void;
  onImportFromClipboard: () => void;
  onGenerate: () => void;
  generating?: boolean;
  disabled?: boolean;
}

export default function PhrasesDropdown({
  onImportFromFile,
  onImportFromClipboard,
  onGenerate,
  generating = false,
  disabled = false,
}: PhrasesDropdownProps) {
  const [showMenu, setShowMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const values = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      if (values.length > 0) {
        onImportFromFile(values);
      }
    };
    reader.onerror = () => {
      alert('Errore durante la lettura del file');
    };
    reader.readAsText(file);
    e.target.value = '';
    setShowMenu(false);
  };

  const handleImportFromFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleGenerate = () => {
    onGenerate();
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setShowMenu(!showMenu)}
        disabled={disabled}
        className="px-2 py-1 rounded border bg-white hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        title="Phrases"
      >
        <MessageSquare size={14} />
        Phrases
      </button>
      {showMenu && (
        <>
          {/* Backdrop per chiudere il menu */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          {/* Menu */}
          <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg z-20 min-w-[200px]">
            <button
              onClick={handleImportFromFileClick}
              className="w-full text-left px-3 py-2 hover:bg-amber-50 rounded-t-lg flex items-center gap-2"
            >
              <Download size={14} />
              Import da File
            </button>
            <button
              onClick={onImportFromClipboard}
              className="w-full text-left px-3 py-2 hover:bg-amber-50 border-t flex items-center gap-2"
            >
              <Download size={14} />
              Import da Clipboard
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || disabled}
              className="w-full text-left px-3 py-2 hover:bg-amber-50 rounded-b-lg border-t disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Generate
                </>
              )}
            </button>
          </div>
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,text/plain"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  );
}

