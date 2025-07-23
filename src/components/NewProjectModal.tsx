import React, { useState, useEffect, useRef } from 'react';
import { X, Folder, FileText, Zap } from 'lucide-react';
import { ProjectData, ProjectInfo } from '../types/project';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (projectInfo: ProjectInfo) => Promise<boolean>;
  onLoadProject?: (id?: string) => void;
  duplicateNameError?: string | null;
  onProjectNameChange?: () => void;
  isLoading?: boolean;
}

const templates = [
  {
    id: 'utility_gas',
    name: 'Utility Gas',
    description: 'Template per servizi di utilità gas',
    icon: Zap,
    color: 'text-blue-400'
  }
];

const languages = [
  { id: 'en', name: 'English' },
  { id: 'it', name: 'Italiano' },
  { id: 'es', name: 'Español' },
  { id: 'fr', name: 'Français' }
];

export function NewProjectModal({ isOpen, onClose, onCreateProject, onLoadProject, duplicateNameError, onProjectNameChange, isLoading }: NewProjectModalProps) {
  const [formData, setFormData] = useState<ProjectInfo>({
    id: '',
    name: '',
    description: '',
    template: 'utility_gas',
    language: 'en'
  });
  const [errors, setErrors] = useState<Partial<ProjectInfo>>({});
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [selectedProjectIdx, setSelectedProjectIdx] = useState<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('http://localhost:3100/projects')
        .then(res => res.json())
        .then(data => setRecentProjects(data))
        .catch((err) => {
          setRecentProjects([]);
          console.error('Errore fetch recentProjects in NewProjectModal:', err);
        });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isOpen]);

  const handleLoadSelectedProject = () => {
    if (selectedProjectIdx === null || !recentProjects[selectedProjectIdx]) return;
    const id = recentProjects[selectedProjectIdx]._id;
    if (onLoadProject) onLoadProject(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: Partial<ProjectInfo> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Il nome del progetto è obbligatorio';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Attendi il risultato della creazione
    const created = await onCreateProject(formData);
    if (created) {
      // onClose(); // RIMOSSO: la chiusura è gestita dal parent tramite appState
      setFormData({
        id: '',
        name: '',
        description: '',
        template: 'utility_gas',
        language: 'en'
      });
      setErrors({});
    }
  };

  const handleInputChange = (field: keyof ProjectInfo, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    if (field === 'name' && onProjectNameChange) {
      onProjectNameChange();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        {/* Spinner overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-50 rounded-2xl">
            <svg className="animate-spin h-12 w-12 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">Nuovo Progetto</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Project Name */}
          <div className="relative">
            <label className="block text-base font-medium text-slate-200 mb-2">
              Nome Progetto *
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`w-full px-4 py-3 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors ${
                errors.name || duplicateNameError ? 'border-red-500' : 'border-slate-600'
              }`}
              placeholder="Inserisci il nome del progetto"
              disabled={isLoading}
            />
            {/* Messaggio errore duplicato sotto la textbox */}
            {duplicateNameError && formData.name.trim() && (
              <p className="mt-1 text-sm text-red-400">{duplicateNameError}</p>
            )}
            {errors.name && (
              <p className="mt-1 text-sm text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Descrizione
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              className={`w-full px-4 py-3 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors resize-none ${
                errors.description ? 'border-red-500' : 'border-slate-600'
              }`}
              placeholder="Descrivi brevemente il progetto"
              disabled={isLoading}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-400">{errors.description}</p>
            )}
          </div>

          {/* Template Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-3">
              Template
            </label>
            <div className="grid grid-cols-1 gap-3">
              {templates.map((template) => {
                const IconComponent = template.icon;
                return (
                  <label
                    key={template.id}
                    className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all ${
                      formData.template === template.id
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      value={template.id}
                      checked={formData.template === template.id}
                      onChange={(e) => handleInputChange('template', e.target.value)}
                      className="sr-only"
                      disabled={isLoading}
                    />
                    <IconComponent className={`w-6 h-6 mr-3 ${template.color}`} />
                    <div>
                      <div className="text-white font-medium">{template.name}</div>
                      <div className="text-slate-400 text-sm">{template.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Language Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Lingua
            </label>
            <select
              value={formData.language}
              onChange={(e) => handleInputChange('language', e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
              disabled={isLoading}
            >
              {languages.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-slate-300 hover:text-white transition-colors"
              disabled={isLoading}
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              disabled={isLoading}
            >
              {isLoading ? 'Caricamento...' : 'Crea Progetto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}