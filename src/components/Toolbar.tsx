import React from 'react';
import { Home, Save, Settings, Play, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { ProjectData } from '../types/project';

export interface ToolbarProps {
  onHome: () => void;
  onSave: () => void | Promise<void>;
  onRun: () => void;
  onSettings: () => void;
  currentProject?: ProjectData | null;
  isSaving?: boolean;
  saveSuccess?: boolean;
  saveError?: string | null;
}

export function Toolbar({
  onHome,
  onSave,
  isSaving = false,
  saveSuccess = false,
  saveError = null,
  onRun,
  onSettings,
  currentProject
}: ToolbarProps) {
  // Verifica se il progetto è vuoto (non ha contenuti)
  const isProjectEmpty = !currentProject ||
    (!currentProject.agentActs?.length &&
     !currentProject.userActs?.length &&
     !currentProject.backendActions?.length &&
     !currentProject.conditions?.length &&
     !currentProject.tasks?.length &&
     !currentProject.macrotasks?.length);

  // Renderizza le informazioni del progetto con colori
  const renderProjectInfo = () => {
    if (!currentProject) {
      return <span className="text-slate-400">Nessun progetto aperto</span>;
    }

    const parts: React.ReactNode[] = [];

    // Progetto
    if (currentProject.name) {
      parts.push(
        <span key="project-label" className="text-slate-900 dark:text-slate-200">Progetto: </span>
      );
      parts.push(
        <span key="project-value" className="text-green-500 font-medium">{currentProject.name}</span>
      );
      if (currentProject.ownerCompany) {
        parts.push(
          <span key="project-owner" className="text-slate-900 dark:text-slate-200"> (owner= </span>
        );
        parts.push(
          <span key="project-owner-value" className="text-green-500">{currentProject.ownerCompany}</span>
        );
        parts.push(
          <span key="project-owner-close" className="text-slate-900 dark:text-slate-200">)</span>
        );
      }
    }

    // Cliente
    if (currentProject.clientName) {
      if (parts.length > 0) {
        parts.push(<span key="separator" className="text-slate-900 dark:text-slate-200"> </span>);
      }
      parts.push(
        <span key="client-label" className="text-slate-900 dark:text-slate-200">Cliente: </span>
      );
      parts.push(
        <span key="client-value" className="text-green-500 font-medium">{currentProject.clientName}</span>
      );
      if (currentProject.ownerClient) {
        parts.push(
          <span key="client-owner" className="text-slate-900 dark:text-slate-200"> (owner: </span>
        );
        parts.push(
          <span key="client-owner-value" className="text-green-500">{currentProject.ownerClient}</span>
        );
        parts.push(
          <span key="client-owner-close" className="text-slate-900 dark:text-slate-200">)</span>
        );
      }
    }

    if (parts.length === 0) {
      return <span className="text-slate-400">Progetto senza nome</span>;
    }

    return <>{parts}</>;
  };

  return (
    <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between">
      {/* Left side - Project info */}
      <div className="flex items-center space-x-4 flex-1 min-w-0">
        <button
          onClick={onHome}
          className="flex items-center justify-center w-10 h-10 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors duration-200 flex-shrink-0"
          title="Torna alla pagina principale"
        >
          <Home className="w-4 h-4" />
        </button>

        <div className="text-sm flex-1 min-w-0">
          {renderProjectInfo()}
        </div>
      </div>

      {/* Center - Save button */}
      <div className="flex items-center">
        <button
          onClick={onSave}
          className={`relative flex items-center gap-2 px-4 py-2 rounded bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-colors disabled:opacity-60`}
          disabled={isSaving}
          style={{ position: 'relative' }}
        >
          {isSaving && <Loader2 className="animate-spin w-5 h-5" />}
          <span>Salva</span>
          {(!isSaving && saveSuccess) && <CheckCircle className="w-5 h-5 text-green-400" />}
          {/* Tooltip errore */}
          {saveError && (
            <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 bg-red-600 text-white text-xs rounded px-2 py-1 shadow z-20 whitespace-nowrap flex items-center gap-1">
              <AlertCircle className="w-4 h-4 mr-1" /> {saveError}
            </span>
          )}
        </button>
      </div>

      {/* Right side - Settings and Run */}
      <div className="flex items-center space-x-3 flex-shrink-0">
        <button
          onClick={onSettings}
          className="flex items-center justify-center w-10 h-10 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors duration-200"
          title="Impostazioni"
        >
          <Settings className="w-4 h-4" />
        </button>

        {!isProjectEmpty && (
          <button
            onClick={onRun}
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-colors duration-200"
          >
            <Play className="w-4 h-4" />
            <span>Esegui</span>
          </button>
        )}
      </div>
    </div>
  );
}