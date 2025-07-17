import React, { useState } from 'react';
import { X, Folder, FileText, Zap } from 'lucide-react';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (projectData: ProjectData) => void;
}

export interface ProjectData {
  name: string;
  description: string;
  template: string;
  language: string;
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

export function NewProjectModal({ isOpen, onClose, onCreateProject }: NewProjectModalProps) {
  const [formData, setFormData] = useState<ProjectData>({
    name: '',
    description: '',
    template: 'utility_gas',
    language: 'en'
  });

  const [errors, setErrors] = useState<Partial<ProjectData>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const newErrors: Partial<ProjectData> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Il nome del progetto è obbligatorio';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onCreateProject(formData);
    onClose();
    
    // Reset form
    setFormData({
      name: '',
      description: '',
      template: 'utility_gas',
      language: 'en'
    });
    setErrors({});
  };

  const handleInputChange = (field: keyof ProjectData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-2xl font-bold text-white">Nuovo Progetto</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Nome Progetto *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`w-full px-4 py-3 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors ${
                errors.name ? 'border-red-500' : 'border-slate-600'
              }`}
              placeholder="Inserisci il nome del progetto"
            />
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
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              Crea Progetto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}