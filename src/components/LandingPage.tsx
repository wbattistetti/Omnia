import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, XCircle, Trash2, Building2, Folder, Loader2, RotateCcw, ChevronDown } from 'lucide-react';
import { useFontClasses } from '../hooks/useFontClasses';
import { OmniaSelect } from './common/OmniaSelect';

interface LandingPageProps {
  onNewProject: () => void;
  recentProjects: any[];
  allProjects: any[];
  onDeleteProject: (id: string) => void;
  onDeleteAllProjects: () => void;
  showAllProjectsModal: boolean;
  setShowAllProjectsModal: (v: boolean) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  onSelectProject: (id: string) => void | Promise<void>;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNewProject,
  recentProjects = [],
  allProjects = [],
  onDeleteProject,
  onDeleteAllProjects,
  showAllProjectsModal,
  setShowAllProjectsModal,
  searchTerm,
  setSearchTerm,
  onSelectProject,
}) => {
  const [showHelp, setShowHelp] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);

  // Stati per filtri combo box
  const [availableClients, setAvailableClients] = useState<string[]>([]);
  const [availableProjectNames, setAvailableProjectNames] = useState<string[]>([]);
  const [availableIndustries, setAvailableIndustries] = useState<string[]>([]);
  const [availableOwnerCompanies, setAvailableOwnerCompanies] = useState<string[]>([]);
  const [availableOwnerClients, setAvailableOwnerClients] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedProjectName, setSelectedProjectName] = useState<string>('');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedOwnerCompany, setSelectedOwnerCompany] = useState<string>('');
  const [selectedOwnerClient, setSelectedOwnerClient] = useState<string>('');

  // Stato per tipo di progetti visualizzati
  const [projectViewType, setProjectViewType] = useState<'all' | 'recent' | 'recovered'>('all');
  const [recoveredProjectsCount, setRecoveredProjectsCount] = useState(0);

  // Font centralizzato dal designer
  const { combinedClass } = useFontClasses();

  // Helper: formatta il nome del client (mostra "Client ?" in grigio se vuoto)
  const formatClientName = (clientName: string | null | undefined): { text: string; isGrey: boolean } => {
    const client = (clientName || '').trim();
    if (!client) {
      return { text: 'Client ?', isGrey: true };
    }
    return { text: client, isGrey: false };
  };

  // Helper: ordina progetti (prima senza client, poi con client ordinati per client e progetto)
  const sortProjects = (projects: any[]) => {
    const withoutClient = projects.filter(p => !(p.clientName || '').trim());
    const withClient = projects.filter(p => (p.clientName || '').trim());

    // Ordina quelli con client: prima per clientName, poi per projectName
    withClient.sort((a, b) => {
      const clientA = (a.clientName || '').trim().toLowerCase();
      const clientB = (b.clientName || '').trim().toLowerCase();
      if (clientA !== clientB) {
        return clientA.localeCompare(clientB);
      }
      const projectA = (a.projectName || a.name || '').trim().toLowerCase();
      const projectB = (b.projectName || b.name || '').trim().toLowerCase();
      return projectA.localeCompare(projectB);
    });

    // Prima quelli senza client, poi quelli con client
    return [...withoutClient, ...withClient];
  };

  // Carica clienti, nomi progetti e owners all'inizio
  useEffect(() => {
    fetch('/api/projects/catalog/clients')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAvailableClients(data);
        }
      })
      .catch(() => setAvailableClients([]));

    fetch('/api/projects/catalog/project-names')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAvailableProjectNames(data);
        }
      })
      .catch(() => setAvailableProjectNames([]));

    // Carica industries
    fetch('/api/projects/catalog/industries')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAvailableIndustries(data);
        }
      })
      .catch(() => setAvailableIndustries([]));

    // Estrai owners unici dai progetti (separati per ownerCompany e ownerClient)
    const uniqueAllProjects = Array.from(new Map(allProjects.map(p => [p._id || p.projectId, p])).values());
    const ownerCompanies = new Set<string>();
    const ownerClients = new Set<string>();
    uniqueAllProjects.forEach((p: any) => {
      // Aggiungi ownerCompany se presente
      const ownerCompany = (p.ownerCompany || '').toString().trim();
      if (ownerCompany) {
        ownerCompanies.add(ownerCompany);
      }
      // Aggiungi ownerClient se presente
      const ownerClient = (p.ownerClient || '').toString().trim();
      if (ownerClient) {
        ownerClients.add(ownerClient);
      }
    });
    setAvailableOwnerCompanies(Array.from(ownerCompanies).sort());
    setAvailableOwnerClients(Array.from(ownerClients).sort());

    // Conta progetti recuperati (status='draft')
    const recovered = uniqueAllProjects.filter((p: any) => p.status === 'draft');
    setRecoveredProjectsCount(recovered.length);
  }, [allProjects]);



  // Filtra progetti per tipo di vista
  const uniqueRecentProjects = Array.from(new Map(recentProjects.map(p => [p._id || p.projectId, p])).values());
  const uniqueAllProjects = Array.from(new Map(allProjects.map(p => [p._id || p.projectId, p])).values());

  // Controlla se ci sono progetti
  const hasProjects = uniqueAllProjects.length > 0;

  // Filtra per tipo di vista (tutti/recenti/recuperati)
  let projectsToShow: any[] = [];
  if (projectViewType === 'recent') {
    projectsToShow = uniqueRecentProjects;
  } else if (projectViewType === 'recovered') {
    projectsToShow = uniqueAllProjects.filter((p: any) => p.status === 'draft');
  } else {
    // 'all' mostra TUTTI i progetti (sia draft che non-draft)
    projectsToShow = uniqueAllProjects;
  }

  // Estrai date uniche per filtro
  const availableDates = Array.from(new Set(
    projectsToShow.map((p: any) => {
      const date = p.updatedAt || p.createdAt;
      return date ? new Date(date).toLocaleDateString() : null;
    }).filter((d): d is string => d !== null)
  )).sort();

  // Filtra per cliente, progetto, industry, data e owner (separati)
  const filteredProjects = projectsToShow.filter((p: any) => {
    const clientMatch = !selectedClient ||
      ((p.clientName || '').trim().toLowerCase() === selectedClient.toLowerCase());
    const projectMatch = !selectedProjectName ||
      ((p.projectName || p.name || '').trim().toLowerCase() === selectedProjectName.toLowerCase());
    const industryMatch = !selectedIndustry ||
      ((p.industry || '').toString().trim().toLowerCase() === selectedIndustry.toLowerCase());
    const dateMatch = !selectedDate ||
      (new Date(p.updatedAt || p.createdAt).toLocaleDateString() === selectedDate);
    const ownerCompany = (p.ownerCompany || '').toString().trim();
    const ownerClient = (p.ownerClient || '').toString().trim();
    const ownerCompanyMatch = !selectedOwnerCompany ||
      (ownerCompany.toLowerCase() === selectedOwnerCompany.toLowerCase());
    const ownerClientMatch = !selectedOwnerClient ||
      (ownerClient.toLowerCase() === selectedOwnerClient.toLowerCase());
    return clientMatch && projectMatch && industryMatch && dateMatch && ownerCompanyMatch && ownerClientMatch;
  });

  // Ordina i progetti
  const sortedRecentProjects = sortProjects(uniqueRecentProjects);
  const sortedFilteredProjects = sortProjects(filteredProjects);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Help button in top-right */}
      <button
        className="absolute top-6 right-8 z-20 flex items-center gap-2 bg-white/90 text-emerald-900 px-4 py-2 rounded-full shadow hover:bg-white"
        onClick={() => setShowHelp(true)}
        title="Guida / Tutorial"
      >
        <HelpCircle className="w-5 h-5" />
        Guida
      </button>

      {/* Background decorative elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-emerald-300 rounded-full blur-3xl"></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center">
        {/* OMNIA title with glow effect */}
        <h1 className="text-8xl md:text-9xl font-bold text-white mb-8 tracking-wider">
          <span className="omnia-glow-letter" style={{ animationDelay: '0s' }}>O</span>
          <span className="omnia-glow-letter" style={{ animationDelay: '0.2s' }}>M</span>
          <span className="omnia-glow-letter" style={{ animationDelay: '0.4s' }}>N</span>
          <span className="omnia-glow-letter" style={{ animationDelay: '0.6s' }}>I</span>
          <span className="omnia-glow-letter" style={{ animationDelay: '0.8s' }}>A</span>
        </h1>

        {/* Payoff */}
        <p className="text-3xl md:text-4xl text-emerald-100 mb-12 font-light tracking-normal max-w-xl mx-auto">
          The platform for the customer care.
        </p>

        {/* Main action buttons */}
        <div className="flex flex-col items-center">
          <div className="flex flex-col md:flex-row gap-6 justify-center items-center">
            <button
              onClick={() => { setShowDropdown(false); onNewProject(); }}
              className="bg-white text-emerald-800 px-10 py-4 rounded-full text-xl font-semibold hover:bg-emerald-50 hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-white/20"
            >
              Nuovo Progetto
            </button>
            {hasProjects && (
              <div className="relative flex flex-col items-start">
                <button
                  onClick={() => setShowDropdown((v) => !v)}
                  className={`bg-white text-emerald-800 px-10 py-4 text-xl font-semibold flex items-center gap-2 shadow-2xl transition-all duration-300
                    ${showDropdown ? 'rounded-t-lg rounded-b-none' : 'rounded-full'}`}
                  style={{
                    borderBottomLeftRadius: showDropdown ? 0 : '9999px',
                    borderBottomRightRadius: showDropdown ? 0 : '9999px',
                  }}
                >
                  Carica Progetto
                  <ChevronDown className="w-5 h-5" />
                </button>
                {showDropdown && (
                <div
                  className="absolute left-0 right-0 top-full mt-0 bg-white rounded-b-lg shadow-2xl z-30 p-2 min-w-[320px] border-t border-emerald-100"
                  style={{
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                  }}
                >
                  {/* Prima voce: Tutti i progetti */}
                  <button
                    className="w-full text-left px-4 py-2 font-semibold text-emerald-700 hover:bg-emerald-100 rounded flex items-center gap-2"
                    onClick={() => { setShowDropdown(false); setProjectViewType('all'); }}
                  >
                    <span>Tutti i progetti</span>
                  </button>
                  <div className="my-2 border-t border-emerald-100" />
                  {/* Ultimi 10 progetti */}
                  {sortedRecentProjects.length === 0 && (
                    <div className="text-slate-400 px-4 py-2">Nessun progetto recente</div>
                  )}
                  {sortedRecentProjects.map((proj) => {
                    const clientInfo = formatClientName(proj.clientName);
                    return (
                      <div key={proj._id} className="flex items-center justify-between px-4 py-2 hover:bg-emerald-50 rounded group">
                        <button
                          className="text-left flex-1 truncate"
                          title={`${clientInfo.text} — ${proj.projectName || proj.name || ''}`}
                          onClick={async () => {
                            const id = (proj._id || proj.projectId) as string;
                            setLoadingProjectId(id);
                            try {
                              const maybe = onSelectProject(id);
                              if ((maybe as any)?.then) await (maybe as any);
                              // chiudi solo dopo che il caricamento ha completato
                              setShowDropdown(false);
                            } catch (e) {
                              setLoadingProjectId(null);
                            }
                          }}
                        >
                          <span className="inline-flex items-center gap-4">
                            <span className={`inline-flex items-center gap-2 font-semibold ${clientInfo.isGrey ? 'text-gray-500' : 'text-emerald-900'}`}>
                              <Building2 className={`w-5 h-5 ${clientInfo.isGrey ? 'text-gray-400' : 'text-emerald-700'}`} />
                              <span>{clientInfo.text}</span>
                            </span>
                            <span className="inline-flex items-center gap-2 text-emerald-900">
                              {loadingProjectId === (proj._id || proj.projectId)
                                ? <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
                                : <Folder className="w-5 h-5 text-emerald-900" />}
                              <span>{proj.projectName || proj.name || '(senza nome)'}</span>
                            </span>
                          </span>
                        </button>
                        <span className="text-xs text-slate-400 ml-2">{(proj.updatedAt || proj.createdAt) ? new Date(proj.updatedAt || proj.createdAt).toLocaleDateString() : ''}</span>
                        <button
                          className="ml-2 text-red-500 opacity-70 hover:opacity-100"
                          title="Elimina progetto"
                          onClick={async () => {
                            const id = proj._id || proj.projectId;
                            setDeletingId(id);
                            try { await onDeleteProject(id); } finally { setDeletingId(null); }
                          }}
                        >
                          {deletingId === (proj._id || proj.projectId)
                            ? <Loader2 className="w-5 h-5 animate-spin" />
                            : <XCircle className="w-5 h-5" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            )}
          </div>

          {/* Pannello progetti sempre visibile sotto Carica Progetto - solo se ci sono progetti */}
          {hasProjects && (
            <div className={`mt-4 w-auto bg-white rounded-xl shadow-2xl relative animate-fade-in ${combinedClass}`}>
            {/* Header con 3 pulsanti/tab */}
            <div className="flex items-center justify-between p-2 border-b border-emerald-200 bg-emerald-50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setProjectViewType('all')}
                  className={`px-3 py-1 rounded font-semibold transition-colors ${
                    projectViewType === 'all'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-white text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  Tutti
                </button>
                <button
                  onClick={() => setProjectViewType('recent')}
                  className={`px-3 py-1 rounded font-semibold transition-colors ${
                    projectViewType === 'recent'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-white text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  Recenti
                </button>
                <button
                  onClick={() => setProjectViewType('recovered')}
                  className={`px-3 py-1 rounded font-semibold transition-colors ${
                    projectViewType === 'recovered'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-white text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  Da recuperare {recoveredProjectsCount > 0 && `(${recoveredProjectsCount})`}
                </button>
              </div>
              <button
                className="flex items-center gap-1 text-red-600 border border-red-200 rounded px-2 py-1 hover:bg-red-50 font-semibold"
                onClick={() => setShowDeleteAllConfirm(true)}
              >
                <Trash2 className="w-3 h-3" /> Elimina tutti
              </button>
            </div>

            {/* Tabella con combo box nelle intestazioni */}
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="border-collapse" style={{ width: 'auto', tableLayout: 'auto' }}>
                <colgroup>
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '200px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '180px' }} />
                  <col style={{ width: '180px' }} />
                  <col style={{ width: '60px' }} />
                </colgroup>
                <thead className="bg-emerald-100 sticky top-0 z-10">
                  <tr>
                    {/* Intestazione Cliente con combo box */}
                    <th className="border border-emerald-200 p-1.5 whitespace-nowrap" style={{ width: '120px', maxWidth: '120px' }}>
                      <OmniaSelect
                        variant="light"
                        options={availableClients}
                        value={selectedClient || null}
                        onChange={(value) => setSelectedClient(value || '')}
                        placeholder="Cliente"
                        showSearchIcon={true}
                        className={combinedClass}
                      />
                    </th>

                    {/* Intestazione Progetto con combo box */}
                    <th className="border border-emerald-200 p-1.5 whitespace-nowrap" style={{ width: '200px' }}>
                      <OmniaSelect
                        variant="light"
                        options={availableProjectNames}
                        value={selectedProjectName || null}
                        onChange={(value) => setSelectedProjectName(value || '')}
                        placeholder="Progetto"
                        showSearchIcon={true}
                        className={combinedClass}
                      />
                    </th>

                    {/* Intestazione Industry con combo box */}
                    <th className="border border-emerald-200 p-1.5 whitespace-nowrap" style={{ width: '120px', maxWidth: '120px' }}>
                      <OmniaSelect
                        variant="light"
                        options={availableIndustries}
                        value={selectedIndustry || null}
                        onChange={(value) => setSelectedIndustry(value || '')}
                        placeholder="Industry"
                        showSearchIcon={true}
                        className={combinedClass}
                      />
                    </th>

                    {/* Intestazione Data con combo box */}
                    <th className="border border-emerald-200 p-1.5 whitespace-nowrap" style={{ width: '110px', maxWidth: '110px' }}>
                      <OmniaSelect
                        variant="light"
                        options={availableDates}
                        value={selectedDate || null}
                        onChange={(value) => setSelectedDate(value || '')}
                        placeholder="Data"
                        showSearchIcon={true}
                        className={combinedClass}
                      />
                    </th>

                    {/* Intestazione Owner (Azienda) con combo box */}
                    <th className="border border-emerald-200 p-1.5 whitespace-nowrap" style={{ width: '180px', maxWidth: '220px' }}>
                      <OmniaSelect
                        variant="light"
                        options={availableOwnerCompanies}
                        value={selectedOwnerCompany || null}
                        onChange={(value) => setSelectedOwnerCompany(value || '')}
                        placeholder="Owner (Azienda)"
                        showSearchIcon={true}
                        className={combinedClass}
                      />
                    </th>

                    {/* Intestazione Owner (Cliente) con combo box */}
                    <th className="border border-emerald-200 p-1.5 whitespace-nowrap" style={{ width: '180px', maxWidth: '220px' }}>
                      <OmniaSelect
                        variant="light"
                        options={availableOwnerClients}
                        value={selectedOwnerClient || null}
                        onChange={(value) => setSelectedOwnerClient(value || '')}
                        placeholder="Owner (Cliente)"
                        showSearchIcon={true}
                        className={combinedClass}
                      />
                    </th>

                    {/* Colonna azioni */}
                    <th className="border border-emerald-200 p-1.5" style={{ width: 'auto' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFilteredProjects.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-4 text-slate-400">
                        Nessun progetto trovato
                      </td>
                    </tr>
                  )}
                  {sortedFilteredProjects.map((proj) => {
                    const clientInfo = formatClientName(proj.clientName);
                    const projectDate = (proj.updatedAt || proj.createdAt) ? new Date(proj.updatedAt || proj.createdAt).toLocaleDateString() : '';
                    // Filtra valori "undefined" e stringhe vuote
                    let industryValue = (proj.industry || '').toString().trim();
                    if (!industryValue || industryValue === 'undefined' || industryValue === 'null') {
                      industryValue = '';
                    }
                    let ownerCompany = (proj.ownerCompany || '').toString().trim();
                    if (!ownerCompany || ownerCompany === 'undefined' || ownerCompany === 'null') {
                      ownerCompany = '';
                    }
                    let ownerClient = (proj.ownerClient || '').toString().trim();
                    if (!ownerClient || ownerClient === 'undefined' || ownerClient === 'null') {
                      ownerClient = '';
                    }
                    const isRecovered = projectViewType === 'recovered';
                    return (
                      <tr
                        key={proj._id}
                        className="group hover:bg-emerald-50 cursor-pointer"
                        onClick={async () => {
                          const id = (proj._id || proj.projectId) as string;
                          setLoadingProjectId(id);
                          try {
                            const maybe = onSelectProject(id);
                            if ((maybe as any)?.then) await (maybe as any);
                          } catch (e) {
                            setLoadingProjectId(null);
                          }
                        }}
                      >
                        <td className={`border border-emerald-200 p-1.5 text-left ${combinedClass}`} style={{ width: '120px', maxWidth: '120px' }}>
                          <div className="flex items-center gap-1.5">
                            <Building2 className={`w-4 h-4 ${clientInfo.isGrey ? 'text-gray-400' : 'text-emerald-700'}`} />
                            <span className={clientInfo.isGrey ? 'text-gray-500' : 'text-emerald-900'}>
                              {clientInfo.text}
                            </span>
                          </div>
                        </td>
                        <td className={`border border-emerald-200 p-1.5 text-left ${combinedClass}`} style={{ width: '200px' }}>
                          <div className="flex items-center gap-1.5">
                            {loadingProjectId === (proj._id || proj.projectId)
                              ? <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                              : <Folder className={`w-4 h-4 ${isRecovered ? 'text-red-600' : 'text-emerald-900'}`} />}
                            <span className="text-emerald-900">{proj.projectName || proj.name || '(senza nome)'}</span>
                          </div>
                        </td>
                        <td className={`border border-emerald-200 p-1.5 text-left text-slate-600 ${combinedClass}`} style={{ width: '120px', maxWidth: '120px' }}>
                          {industryValue || '-'}
                        </td>
                        <td className={`border border-emerald-200 p-1.5 text-left text-slate-600 ${combinedClass}`} style={{ width: '110px', maxWidth: '110px' }}>
                          {projectDate}
                        </td>
                        <td className={`border border-emerald-200 p-1.5 text-left text-slate-600 ${combinedClass}`} style={{ width: '180px', maxWidth: '220px' }}>
                          {ownerCompany || '-'}
                        </td>
                        <td className={`border border-emerald-200 p-1.5 text-left text-slate-600 ${combinedClass}`} style={{ width: '180px', maxWidth: '220px' }}>
                          {ownerClient || '-'}
                        </td>
                        <td className="border border-emerald-200 p-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="text-red-500 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                            title="Elimina progetto"
                            onClick={async () => {
                              const id = proj._id || proj.projectId;
                              setDeletingId(id);
                              try { await onDeleteProject(id); } finally { setDeletingId(null); }
                            }}
                          >
                            {deletingId === (proj._id || proj.projectId)
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {/* Modal conferma eliminazione */}
          {showDeleteAllConfirm && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md">
                <h3 className="text-xl font-bold mb-4 text-emerald-900">Elimina tutti i progetti</h3>
                <p className="mb-4 text-emerald-900">Sei sicuro di voler eliminare tutti i progetti?</p>
                <div className="flex gap-2 justify-end">
                  <button
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-semibold"
                    onClick={() => { setShowDeleteAllConfirm(false); onDeleteAllProjects(); }}
                  >
                    Conferma
                  </button>
                  <button
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 font-semibold"
                    onClick={() => setShowDeleteAllConfirm(false)}
                  >
                    Annulla
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subtle animation elements */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2">
        <div className="w-1 h-8 bg-white/30 rounded-full animate-pulse"></div>
      </div>

      {/* Help modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full relative">
            <button
              className="absolute top-3 right-3 text-emerald-800 hover:text-emerald-600"
              onClick={() => setShowHelp(false)}
              title="Chiudi"
            >
              ×
            </button>
            <h2 className="text-2xl font-bold mb-4 text-emerald-900">Benvenuto in OMNIA!</h2>
            <p className="mb-3 text-emerald-900">
              OMNIA è uno strumento per progettare, salvare e testare flussi di customer care.<br />
              Puoi creare nuovi progetti, caricare progetti esistenti, e visualizzare le azioni, condizioni e task in modo visuale.
            </p>
            <ul className="mb-4 text-emerald-900 list-disc pl-5">
              <li>Crea un nuovo progetto per iniziare da zero.</li>
              <li>Carica un progetto esistente per continuare il lavoro.</li>
              <li>Usa la Sidebar per navigare tra le azioni e i task.</li>
              <li>Salva i tuoi progressi su cloud.</li>
            </ul>
            <a
              href="https://tuo-tutorial-link.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 underline hover:text-emerald-900"
            >
              Guarda il tutorial completo
            </a>
          </div>
        </div>
      )}
    </div>
  );
};