import React, { useState, useRef, useEffect } from 'react';
import { Home, Save, Settings, Play, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { ProjectData } from '../types/project';
import { useAIProvider, AI_PROVIDERS } from '../context/AIProviderContext';
import { useFontStore } from '../state/fontStore';

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
  const { provider, model, setProvider, setModel, providerConfig, availableModels } = useAIProvider();
  const { fontType, fontSize, setFontType, setFontSize } = useFontStore();
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Verifica se il progetto è vuoto (non ha contenuti)
  const isProjectEmpty = !currentProject ||
    (!currentProject.agentActs?.length &&
     !currentProject.userActs?.length &&
     !currentProject.backendActions?.length &&
     !currentProject.conditions?.length &&
     !currentProject.tasks?.length &&
     !currentProject.macrotasks?.length);

  // Chiudi dropdown quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        settingsButtonRef.current &&
        !settingsButtonRef.current.contains(event.target as Node)
      ) {
        setShowSettingsDropdown(false);
      }
    };

    if (showSettingsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSettingsDropdown]);

  const fontTypes: { value: 'sans' | 'serif' | 'mono'; label: string }[] = [
    { value: 'sans', label: 'Sans' },
    { value: 'serif', label: 'Serif' },
    { value: 'mono', label: 'Mono' },
  ];

  const fontSizes: { value: 'xs' | 'sm' | 'base' | 'md' | 'lg'; label: string }[] = [
    { value: 'xs', label: 'XS' },
    { value: 'sm', label: 'SM' },
    { value: 'base', label: 'Base' },
    { value: 'md', label: 'MD' },
    { value: 'lg', label: 'LG' },
  ];

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
      <div className="flex items-center mr-8">
        <button
          onClick={onSave}
          className={`relative flex items-center gap-2 px-4 py-2 rounded bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-colors disabled:opacity-60`}
          disabled={isSaving}
          style={{ position: 'relative' }}
        >
          {isSaving && <Loader2 className="animate-spin w-5 h-5" />}
          <span>Salva Progetti</span>
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
      <div className="flex items-center space-x-3 flex-shrink-0 relative">
        <div className="relative">
          <button
            ref={settingsButtonRef}
            onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
            className="flex items-center justify-center w-10 h-10 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors duration-200"
            title="Impostazioni"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Settings Dropdown */}
          {showSettingsDropdown && (
            <div
              ref={dropdownRef}
              className="absolute right-0 top-full mt-2 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50 p-3 min-w-[280px]"
            >
              {/* Riga 1: Provider AI e Model AI */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1">
                  <label className="text-xs text-slate-400 mb-1 block">Provider</label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as 'groq' | 'openai')}
                    className="w-full bg-slate-700 text-slate-200 text-sm border border-slate-600 rounded px-2 py-1.5 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 hover:bg-slate-600 transition-colors"
                  >
                    {Object.values(AI_PROVIDERS).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-400 mb-1 block">Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-slate-700 text-slate-200 text-sm border border-slate-600 rounded px-2 py-1.5 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 hover:bg-slate-600 transition-colors"
                    title={availableModels.find(m => m.id === model)?.description}
                  >
                    {availableModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Riga 2: Font Type e Font Size */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-xs text-slate-400 mb-1 block">Font</label>
                  <select
                    value={fontType}
                    onChange={(e) => setFontType(e.target.value as 'sans' | 'serif' | 'mono')}
                    className="w-full bg-slate-700 text-slate-200 text-sm border border-slate-600 rounded px-2 py-1.5 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 hover:bg-slate-600 transition-colors"
                  >
                    {fontTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-400 mb-1 block">Size</label>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value as 'xs' | 'sm' | 'base' | 'md' | 'lg')}
                    className="w-full bg-slate-700 text-slate-200 text-sm border border-slate-600 rounded px-2 py-1.5 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 hover:bg-slate-600 transition-colors"
                  >
                    {fontSizes.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

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