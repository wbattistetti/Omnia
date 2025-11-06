import React, { useState, useEffect, useRef } from 'react';
import { X, Folder, FileText, Zap, CircleSlash, ChevronDown } from 'lucide-react';
import { ProjectData, ProjectInfo } from '../types/project';

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
    industry: 'undefined'
  });
  const [errors, setErrors] = useState<Partial<ProjectInfo>>({});
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [selectedProjectIdx, setSelectedProjectIdx] = useState<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [isIndustryOpen, setIsIndustryOpen] = useState(false);
  const [availableClients, setAvailableClients] = useState<string[]>([]);
  const [isClientOpen, setIsClientOpen] = useState(false);
  const [clientInputValue, setClientInputValue] = useState('');
  const [selectedClientIndex, setSelectedClientIndex] = useState<number>(-1);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

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
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      nameInputRef.current.focus();
      // Reset client input quando si apre il modal
      setClientInputValue('');
    } else if (!isOpen) {
      // Reset quando si chiude
      setClientInputValue('');
      setIsClientOpen(false);
    }
  }, [isOpen]);

  // Sincronizza clientInputValue con formData.clientName
  useEffect(() => {
    if (formData.clientName && clientInputValue !== formData.clientName) {
      setClientInputValue(formData.clientName);
    }
  }, [formData.clientName]);

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

  const handleSelectIndustry = (id: string) => {
    setIsIndustryOpen(false);
    handleInputChange('industry', id);
    // keep template aligned when a known template industry is picked
    if (id && id !== 'undefined') {
      handleInputChange('template', id);
    }
  };

  const handleClientSelect = (clientName: string) => {
    setIsClientOpen(false);
    setClientInputValue('');
    handleInputChange('clientName', clientName);
  };

  const handleClientInputChange = (value: string) => {
    setClientInputValue(value);
    handleInputChange('clientName', value);
  };

  // Filtra clienti per autocomplete (usa il valore corrente dell'input)
  const currentClientValue = formData.clientName || clientInputValue || '';
  const searchTerm = currentClientValue.toLowerCase();
  const filteredClients = availableClients.filter(client =>
    client.toLowerCase().includes(searchTerm)
  );
  const canCreateNew = currentClientValue && !availableClients.includes(currentClientValue);

  // Reset indice selezionato quando cambia il filtro
  useEffect(() => {
    if (isClientOpen) {
      setSelectedClientIndex(-1);
    }
  }, [searchTerm, isClientOpen]);

  // Scroll automatico quando si naviga con le frecce
  useEffect(() => {
    if (selectedClientIndex >= 0 && clientDropdownRef.current) {
      const items = clientDropdownRef.current.querySelectorAll('[data-client-index]');
      const selectedItem = items[selectedClientIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedClientIndex]);

  // Gestione navigazione da tastiera
  const handleClientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isClientOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsClientOpen(true);
        setSelectedClientIndex(0);
        e.preventDefault();
      }
      return;
    }

    const items = currentClientValue ? filteredClients : availableClients;
    const maxIndex = items.length - 1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedClientIndex(prev => {
          const next = prev < maxIndex ? prev + 1 : 0;
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedClientIndex(prev => {
          const next = prev > 0 ? prev - 1 : maxIndex;
          return next;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedClientIndex >= 0 && selectedClientIndex < items.length) {
          handleClientSelect(items[selectedClientIndex]);
        } else if (currentClientValue && canCreateNew) {
          // Se non c'è selezione ma c'è un valore nuovo, lo accetta
          handleClientSelect(currentClientValue);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsClientOpen(false);
        setSelectedClientIndex(-1);
        break;
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

          {/* Client Name - Combo box creatable */}
          <div className="relative">
            <label className="block text-base font-medium text-slate-200 mb-2">
              Cliente *
            </label>
            <div className="relative">
              <input
                type="text"
                value={formData.clientName || ''}
                onChange={(e) => {
                  handleClientInputChange(e.target.value);
                  setIsClientOpen(true);
                }}
                onKeyDown={handleClientKeyDown}
                onFocus={() => setIsClientOpen(true)}
                onBlur={() => {
                  // Delay per permettere il click su un item della lista
                  setTimeout(() => {
                    setIsClientOpen(false);
                    setSelectedClientIndex(-1);
                  }, 200);
                }}
                className={`w-full px-4 py-3 pr-10 bg-slate-700 border rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors ${
                  errors.clientName ? 'border-red-500' : 'border-slate-600'
                } ${
                  canCreateNew && currentClientValue ? 'text-blue-400' : 'text-white'
                }`}
                placeholder="Nome del cliente (es. Indesit)"
                disabled={isLoading}
              />
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              {isClientOpen && (
                <div
                  ref={clientDropdownRef}
                  className="absolute z-50 mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                >
                  {currentClientValue ? (
                    // Se c'è un valore, mostra solo clienti filtrati
                    filteredClients.length > 0 && filteredClients.map((client, index) => (
                      <button
                        key={client}
                        data-client-index={index}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevenire onBlur
                          handleClientSelect(client);
                        }}
                        onMouseEnter={() => setSelectedClientIndex(index)}
                        className={`w-full text-left px-4 py-2 text-white ${
                          selectedClientIndex === index
                            ? 'bg-slate-600'
                            : 'hover:bg-slate-700'
                        }`}
                      >
                        {client}
                      </button>
                    ))
                  ) : (
                    // Se il campo è vuoto, mostra tutti i clienti disponibili
                    availableClients.length > 0 && availableClients.map((client, index) => (
                      <button
                        key={client}
                        data-client-index={index}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleClientSelect(client);
                        }}
                        onMouseEnter={() => setSelectedClientIndex(index)}
                        className={`w-full text-left px-4 py-2 text-white ${
                          selectedClientIndex === index
                            ? 'bg-slate-600'
                            : 'hover:bg-slate-700'
                        }`}
                      >
                        {client}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {errors.clientName && (
              <p className="mt-1 text-sm text-red-400">{String(errors.clientName)}</p>
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

          {/* Industry (combo con icone) */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-3">
              Industry
            </label>
            <div className="relative">
              {(() => {
                const sel = industries.find(i => i.id === (formData.industry || 'undefined')) || industries[0];
                const SelectedIcon = sel.Icon;
                return (
                  <button
                    type="button"
                    onClick={() => setIsIndustryOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/60 border border-slate-600 rounded-lg text-white hover:border-slate-500 transition-colors"
                    disabled={isLoading}
                  >
                    <span className="flex items-center gap-3">
                      <SelectedIcon className={`w-5 h-5 ${sel.color}`} />
                      <span className="text-white font-medium">{sel.name}</span>
                      <span className="text-slate-400 text-sm">{sel.description}</span>
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>
                );
              })()}
              {isIndustryOpen && (
                <div className="absolute z-50 mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden">
                  {industries.map(opt => {
                    const OptIcon = opt.Icon;
                    const active = (formData.industry || 'undefined') === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectIndustry(opt.id)}
                        className={`w-full text-left px-4 py-2 hover:bg-slate-700 flex items-center gap-3 ${active ? 'bg-slate-700' : ''}`}
                      >
                        <OptIcon className={`w-5 h-5 ${opt.color}`} />
                        <div>
                          <div className="text-white font-medium">{opt.name}</div>
                          <div className="text-slate-400 text-xs">{opt.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
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