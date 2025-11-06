import React, { useState, useEffect, useRef } from 'react';
import { X, Folder, FileText, Zap, CircleSlash } from 'lucide-react';
import { ProjectData, ProjectInfo } from '../types/project';
import { OmniaSelect } from './common/OmniaSelect';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (projectInfo: ProjectInfo) => Promise<boolean>;
  onLoadProject?: (id?: string) => void;
  duplicateNameError?: string | null;
  onProjectNameChange?: () => void;
  isLoading?: boolean;
  onFactoryTemplatesLoaded?: (templates: any[]) => void; // AGGIUNTA
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
  { id: 'pt', name: 'Português' },
  { id: 'en', name: 'English' },
  { id: 'it', name: 'Italiano' },
  { id: 'es', name: 'Español' },
  { id: 'fr', name: 'Français' }
];

const industries = [
  { id: 'undefined', name: 'undefined', description: 'Start with empty dictionaries', Icon: CircleSlash, color: 'text-slate-300' },
  { id: 'utility_gas', name: 'Utility Gas', description: 'Template per servizi di utilità gas', Icon: Zap, color: 'text-blue-400' },
];

export function NewProjectModal({ isOpen, onClose, onCreateProject, onLoadProject, duplicateNameError, onProjectNameChange, isLoading, onFactoryTemplatesLoaded }: NewProjectModalProps) {
  const [formData, setFormData] = useState<ProjectInfo>({
    id: '',
    name: '',
    description: '',
    template: 'utility_gas',
    language: 'pt',
    clientName: '',
    industry: 'undefined',
    ownerCompany: '',
    ownerClient: ''
  });
  const [errors, setErrors] = useState<Partial<ProjectInfo>>({});
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [selectedProjectIdx, setSelectedProjectIdx] = useState<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [availableIndustries, setAvailableIndustries] = useState<string[]>([]);
  const [availableClients, setAvailableClients] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetch('/projects')
        .then(res => res.json())
        .then(data => setRecentProjects(data))
        .catch(() => setRecentProjects([]));

      // Carica lista clienti esistenti
      fetch('/api/projects/catalog/clients')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setAvailableClients(data);
          }
        })
        .catch(() => setAvailableClients([]));

      // Carica lista industry: unifica da catalog e factory
      Promise.all([
        fetch('/api/projects/catalog/industries').then(res => res.json()).catch(() => []),
        fetch('/api/factory/industries').then(res => res.json()).catch(() => [])
      ]).then(([catalogIndustries, factoryIndustries]) => {
        const industriesSet = new Set<string>();
        // Aggiungi da catalog (sono stringhe)
        if (Array.isArray(catalogIndustries)) {
          catalogIndustries.forEach((ind: string) => {
            if (ind && typeof ind === 'string' && ind.trim()) {
              industriesSet.add(ind.trim());
            }
          });
        }
        // Aggiungi da factory (sono oggetti con name o industryId)
        if (Array.isArray(factoryIndustries)) {
          factoryIndustries.forEach((ind: any) => {
            const name = ind?.name || ind?.industryId || '';
            if (name && typeof name === 'string' && name.trim()) {
              industriesSet.add(name.trim());
            }
          });
        }
        // Aggiungi le industry hardcoded (incluso 'undefined' se necessario)
        industries.forEach(ind => {
          if (ind.id) {
            industriesSet.add(ind.id);
          }
        });
        const uniqueIndustries = Array.from(industriesSet).sort();
        setAvailableIndustries(uniqueIndustries);
      }).catch(() => {
        // Fallback: usa solo le industry hardcoded (incluso 'undefined')
        const hardcoded = industries.map(ind => ind.id);
        setAvailableIndustries(hardcoded);
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
    if (!formData.ownerCompany?.trim()) {
      newErrors.ownerCompany = 'Owner azienda è obbligatorio';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Se l'industry è nuova (non esiste nella lista), salvala nel factory
    if (formData.industry && formData.industry.trim() && formData.industry !== 'undefined') {
      const industryName = formData.industry.trim();
      if (!availableIndustries.includes(industryName)) {
        try {
          await fetch('/api/factory/industries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: industryName })
          });
          // Aggiungi alla lista locale per evitare duplicati
          setAvailableIndustries(prev => [...prev, industryName].sort());
        } catch (err) {
          // Ignora errori (es. industry già esistente) e procedi comunque
          console.warn('Errore nel salvare industry nel factory:', err);
        }
      }
    }

    // Attendi il risultato della creazione
    const created = await onCreateProject(formData);
    if (created) {
      // Dopo la creazione, carica i DDT templates dalla factory
      if (onFactoryTemplatesLoaded) {
        fetch('/api/factory/dialogue-templates')
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) onFactoryTemplatesLoaded(data);
          });
      }
      // onClose(); // RIMOSSO: la chiusura è gestita dal parent tramite appState
      setFormData({
        id: '',
        name: '',
        description: '',
        template: 'utility_gas',
        language: 'en',
        clientName: '',
        industry: 'undefined',
        ownerCompany: '',
        ownerClient: ''
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

  const handleIndustryChange = (value: string | null) => {
    if (value) {
      handleInputChange('industry', value);
      // keep template aligned when a known template industry is picked
      if (value !== 'undefined') {
        handleInputChange('template', value);
      }
    } else {
      handleInputChange('industry', 'undefined');
    }
  };

  const handleIndustryCreate = async (inputValue: string) => {
    // Salva la nuova industry nel factory
    if (inputValue && inputValue.trim() && inputValue !== 'undefined') {
      try {
        await fetch('/api/factory/industries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: inputValue.trim() })
        });
        // Aggiungi alla lista locale
        setAvailableIndustries(prev => [...prev, inputValue.trim()].sort());
      } catch (err) {
        console.warn('Errore nel salvare industry nel factory:', err);
      }
    }
  };

  const handleClientChange = (value: string | null) => {
    handleInputChange('clientName', value || '');
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
          {/* Riga 1: Nome Progetto + Cliente */}
          <div className="grid grid-cols-2 gap-4">
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

            {/* Client Name - Combo box creatable */}
            <div className="relative">
              <label className="block text-base font-medium text-slate-200 mb-2">
                Cliente *
              </label>
              <OmniaSelect
                variant="dark"
                options={availableClients}
                value={formData.clientName || null}
                onChange={handleClientChange}
                placeholder="Nome del cliente (es. Indesit)"
                isDisabled={isLoading}
                isInvalid={!!errors.clientName}
              />
              {errors.clientName && (
                <p className="mt-1 text-sm text-red-400">{String(errors.clientName)}</p>
              )}
            </div>
          </div>

          {/* Riga 2: Descrizione */}
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

          {/* Riga 3: Industry + Lingua */}
          <div className="grid grid-cols-2 gap-4">
            {/* Industry - Combo box creatable */}
            <div className="relative">
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Industry
              </label>
              <OmniaSelect
                variant="dark"
                options={availableIndustries}
                value={formData.industry || null}
                onChange={handleIndustryChange}
                onCreateOption={handleIndustryCreate}
                placeholder="Nome industry (es. utility_gas)"
                isDisabled={isLoading}
                isInvalid={!!errors.industry}
              />
              {errors.industry && (
                <p className="mt-1 text-sm text-red-400">{String(errors.industry)}</p>
              )}
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
          </div>

          {/* Riga 4: Owner Azienda + Owner Cliente */}
          <div className="grid grid-cols-2 gap-4">
            {/* Owner Company */}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Owner (Azienda) *
              </label>
              <input
                type="text"
                value={formData.ownerCompany || ''}
                onChange={(e) => handleInputChange('ownerCompany', e.target.value)}
                className={`w-full px-4 py-3 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors ${
                  errors.ownerCompany ? 'border-red-500' : 'border-slate-600'
                }`}
                placeholder="Owner del progetto (chi lo costruisce)"
                disabled={isLoading}
              />
              {errors.ownerCompany && (
                <p className="mt-1 text-sm text-red-400">{String(errors.ownerCompany)}</p>
              )}
            </div>

            {/* Owner Client */}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Owner (Cliente)
              </label>
              <input
                type="text"
                value={formData.ownerClient || ''}
                onChange={(e) => handleInputChange('ownerClient', e.target.value)}
                className={`w-full px-4 py-3 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors ${
                  errors.ownerClient ? 'border-red-500' : 'border-slate-600'
                }`}
                placeholder="Owner del progetto (chi lo commissiona)"
                disabled={isLoading}
              />
              {errors.ownerClient && (
                <p className="mt-1 text-sm text-red-400">{String(errors.ownerClient)}</p>
              )}
            </div>
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