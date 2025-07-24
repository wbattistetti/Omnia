import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  isLoading?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, isLoading }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative">
        {isLoading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 rounded-2xl">
            <svg className="animate-spin h-10 w-10 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
          </div>
        )}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            disabled={isLoading}
            aria-label="Chiudi modale"
          >
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && <div className="p-4 border-t border-slate-700 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal; 