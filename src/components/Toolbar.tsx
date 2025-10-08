import React from 'react';
import { Plus, Save, FolderOpen, Settings, Play, Download, Upload, Loader2, CheckCircle, AlertCircle, Palette } from 'lucide-react';
import { ProjectDataService } from '../services/ProjectDataService';
import { ThemeToggle } from '../theme/components/ThemeToggle';

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
  const handleExport = async () => {
    try {
      const data = await ProjectDataService.exportProjectData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `omnia-project-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      // console.error('Export failed:', error);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          await ProjectDataService.importProjectData(text);
          window.location.reload(); // Refresh to show imported data
        } catch (error) {
          // console.error('Import failed:', error);
          alert('Errore nell\'importazione del file');
        }
      }
    };
    input.click();
  };

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
        
        <div className="h-6 w-px bg-slate-600"></div>
        
        <button
          onClick={handleExport}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors duration-200"
          title="Esporta progetto"
        >
          <Download className="w-4 h-4" />
          <span>Esporta</span>
        </button>
        
        <button
          onClick={handleImport}
          className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded-lg transition-colors duration-200"
          title="Importa progetto"
        >
          <Upload className="w-4 h-4" />
          <span>Importa</span>
        </button>
      </div>

      {/* Center - Project name/status */}
      <div className="flex items-center space-x-3">
        <div className="text-slate-300 text-sm">
          <span className="text-slate-500">Progetto:</span>
          <span className="ml-2 font-medium">{projectName ? projectName : "Nessun progetto aperto"}</span>
        </div>
      </div>

      {/* Right side - Secondary actions */}
      <div className="flex items-center space-x-2">
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