import React from 'react';

interface DockPanelProps {
  open: boolean;
  onClose: () => void;
  onClear?: () => void; // aggiunto per clear chat
  children: React.ReactNode;
}

export const DockPanel: React.FC<DockPanelProps> = ({ open, onClose, onClear, children }) => {
  return (
    <div
      className={`
        fixed top-0 right-0 h-full z-50 transition-transform duration-300
        bg-white shadow-lg border-l
        ${open ? 'translate-x-0' : 'translate-x-full'}
        w-[350px] max-w-full
      `}
      style={{ boxShadow: open ? '0 0 16px #0002' : 'none' }}
    >
      {/* Barra superiore con titolo e clear chat */}
      <div className="absolute top-0 left-0 w-full flex items-center justify-center h-10 border-b bg-gray-50">
        <button
          className="absolute left-2 text-gray-500 hover:text-gray-800"
          onClick={onClose}
          aria-label="Chiudi"
        >
          ✕
        </button>
        <span className="font-bold text-center flex-1">Conversazione</span>
        <div className="absolute right-2 flex items-center gap-2">
          {onClear && (
            <button
              className="text-gray-500 hover:text-red-600"
              aria-label="Clear chat"
              onClick={onClear}
              title="Pulisci la chat"
            >
              🗑️ <span className="sr-only">Clear chat</span>
            </button>
          )}
        </div>
      </div>
      <div className="pt-10 h-full overflow-y-auto">{children}</div>
    </div>
  );
}; 