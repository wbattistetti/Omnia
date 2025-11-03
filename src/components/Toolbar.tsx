import React, { useState, useRef, useEffect } from 'react';
import { Plus, Save, FolderOpen, Settings, Play, Loader2, CheckCircle, AlertCircle, Palette, ChevronDown } from 'lucide-react';
import { ThemeToggle } from '../theme/components/ThemeToggle';
import { useAIProvider, AI_PROVIDERS } from '../context/AIProviderContext';
import { FontControls } from './common/FontControls';

export interface ToolbarProps {
  onNewProject: () => void;
  onOpenProject?: () => void;
  onSave: () => void | Promise<void>;
  onRun: () => void;
  onSettings: () => void;
  projectName?: string;
  isSaving?: boolean;
  saveSuccess?: boolean;
  saveError?: string | null;
}

export function Toolbar({
  onNewProject,
  onOpenProject,
  onSave,
  isSaving = false,
  saveSuccess = false,
  saveError = null,
  onRun,
  onSettings,
  projectName
}: ToolbarProps & { isSaving?: boolean; saveSuccess?: boolean; saveError?: string | null }) {
  const { provider, model, setProvider, setModel, providerConfig, availableModels } = useAIProvider();
  const [providerSelectWidth, setProviderSelectWidth] = useState(100);
  const [modelSelectWidth, setModelSelectWidth] = useState(150);
  const providerSelectRef = useRef<HTMLSelectElement>(null);
  const modelSelectRef = useRef<HTMLSelectElement>(null);

  // Calculate select widths based on content
  useEffect(() => {
    if (providerSelectRef.current) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context) {
        context.font = '500 13px system-ui, -apple-system, sans-serif';
        const text = providerConfig.label;
        const metrics = context.measureText(text);
        setProviderSelectWidth(Math.max(metrics.width + 50, 100));
      }
    }
  }, [provider, providerConfig.label]);

  useEffect(() => {
    if (modelSelectRef.current) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (context) {
        context.font = '500 13px system-ui, -apple-system, sans-serif';
        const selectedModel = availableModels.find(m => m.id === model);
        const text = selectedModel?.label || model;
        const metrics = context.measureText(text);
        setModelSelectWidth(Math.max(metrics.width + 50, 150));
      }
    }
  }, [model, availableModels]);

  return (
    <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between">
      {/* Left side - Main actions */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onNewProject}
          className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 font-medium"
        >
          <Plus className="w-4 h-4" />
          <span>Nuovo Progetto</span>
        </button>

        <button
          onClick={onOpenProject}
          className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg transition-colors duration-200"
        >
          <FolderOpen className="w-4 h-4" />
          <span>Apri</span>
        </button>

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

      {/* Center - Project name/status */}
      <div className="flex items-center space-x-3">
        <div className="text-slate-300 text-sm">
          <span className="text-slate-500">Progetto:</span>
          <span className="ml-2 font-medium">{projectName ? projectName : "Nessun progetto aperto"}</span>
        </div>
      </div>

      {/* Right side - AI Provider/Model + Secondary actions */}
      <div className="flex items-center space-x-3">
        {/* AI Provider and Model Selectors */}
        <div className="flex items-center space-x-2 bg-slate-700/50 px-3 py-1.5 rounded-lg border border-slate-600">
          <label className="text-xs text-slate-400 font-medium">AI:</label>
          <select
            ref={providerSelectRef}
            value={provider}
            onChange={(e) => setProvider(e.target.value as 'groq' | 'openai')}
            style={{ width: `${providerSelectWidth}px` }}
            className="bg-slate-800 text-slate-200 text-sm font-medium border border-slate-600 rounded px-2 py-1 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 hover:bg-slate-750 transition-colors"
          >
            {Object.values(AI_PROVIDERS).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          <span className="text-slate-500">|</span>

          <select
            ref={modelSelectRef}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{ width: `${modelSelectWidth}px` }}
            className="bg-slate-800 text-slate-200 text-sm font-medium border border-slate-600 rounded px-2 py-1 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 hover:bg-slate-750 transition-colors"
            title={availableModels.find(m => m.id === model)?.description}
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="h-6 w-px bg-slate-600"></div>

        {/* Font Controls */}
        <FontControls />

        <div className="h-6 w-px bg-slate-600"></div>

        <ThemeToggle />

        <button
          onClick={onRun}
          className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-colors duration-200"
        >
          <Play className="w-4 h-4" />
          <span>Esegui</span>
        </button>

        <button
          onClick={onSettings}
          className="flex items-center justify-center w-10 h-10 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors duration-200"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}