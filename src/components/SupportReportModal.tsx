import React from 'react';
import Modal from './Modal';

interface ErrorData {
  errorId: string;
  step?: string;
  input?: string;
  browser?: string;
  os?: string;
  [key: string]: any;
}

interface SupportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorData: ErrorData;
  onSend: () => void;
  isLoading: boolean;
  sent: boolean;
}

const SupportReportModal: React.FC<SupportReportModalProps> = ({ isOpen, onClose, errorData, onSend, isLoading, sent }) => {
  const platformId = errorData.platformId || 'omnia-prod-01';
  const licenseId = errorData.licenseId || 'LIC-123456';
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invio segnalazione tecnica"
      isLoading={isLoading}
      footer={
        <>
          <button
            onClick={onSend}
            disabled={isLoading || sent}
            title="Cliccando qui mandi un report dettagliato dell’errore al servizio tecnico di OMNIA. Sul cruscotto ti apparirà lo stato di lavorazione del tuo ticket."
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-5 py-2 font-medium transition-colors disabled:opacity-60"
          >
            {isLoading ? 'Invio...' : sent ? 'Inviato!' : 'Invia report'}
          </button>
          <button onClick={onClose} disabled={isLoading} className="px-5 py-2 text-slate-300 hover:text-white transition-colors">Annulla</button>
        </>
      }
    >
      <div className="space-y-2">
        <div className="text-center font-bold text-purple-700 text-lg mb-1">OMNIA BACKEND</div>
        <div className="flex flex-col items-center text-xs text-slate-400 mb-2">
          <div><b>Platform ID:</b> <span className="font-mono text-white">{platformId}</span></div>
          <div><b>License ID:</b> <span className="font-mono text-white">{licenseId}</span></div>
        </div>
        <div className="text-red-700 bg-red-100 rounded px-3 py-2 font-semibold text-base">AI is not responding!</div>
        <div className="text-xs text-slate-400">Controlla i dati prima di inviare la segnalazione:</div>
        <div className="bg-slate-700 rounded p-3 text-sm text-white space-y-1">
          <div><b>ID errore:</b> <code>{errorData.errorId}</code></div>
          <div><b>Platform ID:</b> <span className="font-mono">{platformId}</span></div>
          <div><b>License ID:</b> <span className="font-mono">{licenseId}</span></div>
          {errorData.step && <div><b>Step:</b> {errorData.step}</div>}
          {errorData.input && <div><b>Input:</b> {errorData.input}</div>}
          {errorData.browser && <div><b>Browser:</b> {errorData.browser}</div>}
          {errorData.os && <div><b>OS:</b> {errorData.os}</div>}
        </div>
        {sent && <div className="text-green-700 bg-green-100 rounded px-3 py-2 font-semibold mt-2">Ticket inviato! Puoi seguirne lo stato dal cruscotto.</div>}
      </div>
    </Modal>
  );
};

export default SupportReportModal; 