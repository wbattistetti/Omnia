import React, { useState, useEffect, useRef } from 'react';
import { HelpCircle, XCircle, Trash2, Building2, Folder, Loader2, RotateCcw, ChevronDown, FileText, ExternalLink, Search } from 'lucide-react';
import { useFontClasses } from '../hooks/useFontClasses';
import { OmniaSelect, OmniaSelectOption } from './common/OmniaSelect';

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
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [openVersionMenuId, setOpenVersionMenuId] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [hasEverLoadedProjects, setHasEverLoadedProjects] = useState(false);

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

  // Stato per tracciare quale colonna è in modalità ricerca
  const [searchingColumn, setSearchingColumn] = useState<string | null>(null);

  // Stato per tipo di progetti visualizzati
  const [projectViewType, setProjectViewType] = useState<'all' | 'recent' | 'recovered'>('all');
  const [recoveredProjectsCount, setRecoveredProjectsCount] = useState(0);

  // Font centralizzato dal designer
  const { combinedClass } = useFontClasses();

  // Helper: prepara opzioni con "All" come prima opzione e separatore
  const prepareOptionsWithAll = (options: string[]): OmniaSelectOption[] => {
    const sorted = [...options].sort();
    return [
      { value: '', label: 'All' },
      { value: '__separator__', label: '──────────', isDisabled: true },
      ...sorted.map(opt => ({ value: opt, label: opt }))
    ];
  };

  // Helper: gestisce il cambio valore e chiude la ricerca se "All" è selezionato
  const handleColumnChange = (column: string, value: string | null, setter: (v: string) => void) => {
    // Ignora il separatore
    if (value === '__separator__') {
      return;
    }
    setter(value || '');
    // Se si seleziona "All" (value === ''), chiudi la ricerca
    if (value === '') {
      setSearchingColumn(null);
    }
  };

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
    console.log('[LandingPage] useEffect triggered:', { allProjectsCount: allProjects.length, initialLoadComplete });
    // Solo al primo mount imposta loading
    if (!initialLoadComplete) {
      console.log('[LandingPage] Setting initial loading state');
      setLoadingProjects(true);
      setDataReady(false);
    }

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

    // Traccia se abbiamo mai caricato progetti (per evitare di mostrare "Nessun progetto" prima del primo caricamento)
    if (uniqueAllProjects.length > 0 && !hasEverLoadedProjects) {
      console.log('[LandingPage] First time projects loaded, count:', uniqueAllProjects.length);
      setHasEverLoadedProjects(true);
    }

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


    // Caricamento completato - ritarda leggermente solo al primo caricamento
    if (!initialLoadComplete) {
      console.log('[LandingPage] Starting timeout sequence, allProjects count:', allProjects.length);
      setTimeout(() => {
        console.log('[LandingPage] Setting loadingProjects to false, allProjects count:', allProjects.length);
        setLoadingProjects(false);
        // Attendi ancora un po' prima di rendere i dati "pronti" per evitare flash
        setTimeout(() => {
          console.log('[LandingPage] Setting dataReady to true, allProjects count:', allProjects.length, 'hasProjects:', uniqueAllProjects.length > 0);
          setDataReady(true);
          setInitialLoadComplete(true);
        }, 300);
      }, 100);
    } else {
      // Se initialLoadComplete è già true ma allProjects cambia, aggiorna dataReady se necessario
      if (allProjects.length > 0 && !dataReady) {
        console.log('[LandingPage] allProjects updated after initial load, setting dataReady to true');
        setDataReady(true);
      }
    }
  }, [allProjects, initialLoadComplete]);



  // Filtra progetti per tipo di vista
  const uniqueRecentProjects = Array.from(new Map(recentProjects.map(p => [p._id || p.projectId, p])).values());
  const uniqueAllProjects = Array.from(new Map(allProjects.map(p => [p._id || p.projectId, p])).values());

  // Controlla se ci sono progetti
  const hasProjects = uniqueAllProjects.length > 0;

  // Debug log per tracciare gli stati (solo quando cambiano valori significativi)
  useEffect(() => {
    console.log('[LandingPage] State update:', {
      showDropdown,
      loadingProjects,
      dataReady,
      hasProjects,
      allProjectsCount: allProjects.length,
      uniqueAllProjectsCount: uniqueAllProjects.length,
      initialLoadComplete,
      hasEverLoadedProjects
    });
  }, [showDropdown, loadingProjects, dataReady, hasProjects, allProjects.length, uniqueAllProjects.length, initialLoadComplete, hasEverLoadedProjects]);

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
            <div className="relative flex flex-col items-start">
              <button
                onClick={() => {
                  const newValue = !showDropdown;
                  console.log('[LandingPage] Chevron clicked, showDropdown:', newValue, {
                    loadingProjects,
                    dataReady,
                    hasProjects,
                    allProjectsCount: allProjects.length
                  });
                  setShowDropdown(newValue);
                }}
                className={`bg-white text-emerald-800 px-10 py-4 text-xl font-semibold flex items-center gap-2 shadow-2xl transition-all duration-300 rounded-full hover:bg-emerald-50 hover:scale-105`}
              >
                Progetti esistenti
                {/* Spinner nel bottone solo se dropdown è aperto E progetti non sono pronti */}
                {(showDropdown && (loadingProjects || !dataReady || (!hasEverLoadedProjects && allProjects.length === 0))) ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>

              {/* Messaggio quando non ci sono progetti - solo se i dati sono pronti E non sta caricando E abbiamo già caricato almeno una volta */}
              {(() => {
                // Mostra "Nessun progetto" solo se:
                // 1. Il dropdown è aperto
                // 2. Non ci sono progetti
                // 3. I dati sono pronti (caricamento completato)
                // 4. NON sta ancora caricando
                // 5. Abbiamo già caricato progetti almeno una volta (per evitare di mostrare "Nessun progetto" prima del primo caricamento)
                const shouldShow = showDropdown && !hasProjects && dataReady && !loadingProjects && hasEverLoadedProjects;
                if (shouldShow) {
                  console.log('[LandingPage] Showing "Nessun progetto":', { showDropdown, hasProjects, dataReady, loadingProjects, hasEverLoadedProjects });
                }
                return shouldShow ? (
                  <div className="mt-2 text-emerald-100 text-lg">
                    Nessun progetto
                  </div>
                ) : null;
              })()}
              {false && showDropdown && (
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
          </div>

          {/* Pannello progetti visibile solo quando showDropdown è true, dati pronti E non sta caricando */}
          {hasProjects && showDropdown && dataReady && !loadingProjects && (
            <div className={`mt-4 w-auto bg-white rounded-xl shadow-2xl relative animate-fade-in ${combinedClass}`} style={{ overflow: 'visible' }}>
            {/* Header con 3 pulsanti/tab */}
            <div className="flex items-center justify-between p-2 border-b border-emerald-200 bg-emerald-50 rounded-t-xl" style={{ paddingRight: '80px', marginRight: 0 }}>
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
              <div className="flex flex-col items-end gap-1" style={{ marginRight: 0 }}>
                <button
                  className="text-red-600 border border-red-200 rounded px-2 py-1 hover:bg-red-50 font-semibold"
                  onClick={() => setShowDeleteAllConfirm(!showDeleteAllConfirm)}
                >
                  Elimina tutti
                </button>

                {/* Pulsanti Conferma/Annulla appaiono sotto quando showDeleteAllConfirm è true */}
                {showDeleteAllConfirm && (
                  <div className="flex gap-2">
                    <button
                      className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm font-semibold"
                      onClick={() => { setShowDeleteAllConfirm(false); onDeleteAllProjects(); }}
                    >
                      Conferma
                    </button>
                    <button
                      className="bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300 text-sm font-semibold"
                      onClick={() => setShowDeleteAllConfirm(false)}
                    >
                      Annulla
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Griglia con combo box nelle intestazioni */}
            <div className="max-h-[60vh] overflow-y-auto overflow-x-visible">
              <div
                className="grid border-collapse"
                style={{
                  gridTemplateColumns: 'minmax(120px, 200px) minmax(200px, 300px) minmax(120px, 200px) minmax(110px, 150px) minmax(180px, 250px) minmax(180px, 250px)',
                  width: '100%'
                }}
              >
                {/* Header row */}
                <div className="bg-emerald-100 sticky top-0 z-10 border border-emerald-200 p-1.5">
                  {searchingColumn === 'cliente' ? (
                    <OmniaSelect
                      variant="light"
                      options={prepareOptionsWithAll(availableClients)}
                      value={selectedClient || null}
                      onChange={(value) => handleColumnChange('cliente', value, setSelectedClient)}
                      onBlur={() => setSearchingColumn(null)}
                      onMenuClose={() => setSearchingColumn(null)}
                      placeholder="Cliente"
                      className={combinedClass}
                      menuIsOpen={true}
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`${combinedClass} text-emerald-900 font-semibold`}>Cliente</span>
                      <Search
                        className="w-4 h-4 text-emerald-700 cursor-pointer hover:text-emerald-900"
                        onClick={() => setSearchingColumn('cliente')}
                      />
                    </div>
                  )}
                </div>
                <div className="bg-emerald-100 sticky top-0 z-10 border border-emerald-200 p-1.5">
                  {searchingColumn === 'progetto' ? (
                    <OmniaSelect
                      variant="light"
                      options={prepareOptionsWithAll(availableProjectNames)}
                      value={selectedProjectName || null}
                      onChange={(value) => handleColumnChange('progetto', value, setSelectedProjectName)}
                      onBlur={() => setSearchingColumn(null)}
                      onMenuClose={() => setSearchingColumn(null)}
                      placeholder="Progetto"
                      className={combinedClass}
                      menuIsOpen={true}
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`${combinedClass} text-emerald-900 font-semibold`}>Progetto</span>
                      <Search
                        className="w-4 h-4 text-emerald-700 cursor-pointer hover:text-emerald-900"
                        onClick={() => setSearchingColumn('progetto')}
                      />
                    </div>
                  )}
                </div>
                <div className="bg-emerald-100 sticky top-0 z-10 border border-emerald-200 p-1.5">
                  {searchingColumn === 'industry' ? (
                    <OmniaSelect
                      variant="light"
                      options={prepareOptionsWithAll(availableIndustries)}
                      value={selectedIndustry || null}
                      onChange={(value) => handleColumnChange('industry', value, setSelectedIndustry)}
                      onBlur={() => setSearchingColumn(null)}
                      onMenuClose={() => setSearchingColumn(null)}
                      placeholder="Industry"
                      className={combinedClass}
                      menuIsOpen={true}
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`${combinedClass} text-emerald-900 font-semibold`}>Industry</span>
                      <Search
                        className="w-4 h-4 text-emerald-700 cursor-pointer hover:text-emerald-900"
                        onClick={() => setSearchingColumn('industry')}
                      />
                    </div>
                  )}
                </div>
                <div className="bg-emerald-100 sticky top-0 z-10 border border-emerald-200 p-1.5">
                  {searchingColumn === 'data' ? (
                    <OmniaSelect
                      variant="light"
                      options={prepareOptionsWithAll(availableDates)}
                      value={selectedDate || null}
                      onChange={(value) => handleColumnChange('data', value, setSelectedDate)}
                      onBlur={() => setSearchingColumn(null)}
                      onMenuClose={() => setSearchingColumn(null)}
                      placeholder="Data"
                      className={combinedClass}
                      menuIsOpen={true}
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`${combinedClass} text-emerald-900 font-semibold`}>Data</span>
                      <Search
                        className="w-4 h-4 text-emerald-700 cursor-pointer hover:text-emerald-900"
                        onClick={() => setSearchingColumn('data')}
                      />
                    </div>
                  )}
                </div>
                <div className="bg-emerald-100 sticky top-0 z-10 border border-emerald-200 p-1.5">
                  {searchingColumn === 'ownerAzienda' ? (
                    <OmniaSelect
                      variant="light"
                      options={prepareOptionsWithAll(availableOwnerCompanies)}
                      value={selectedOwnerCompany || null}
                      onChange={(value) => handleColumnChange('ownerAzienda', value, setSelectedOwnerCompany)}
                      onBlur={() => setSearchingColumn(null)}
                      onMenuClose={() => setSearchingColumn(null)}
                      placeholder="Owner (Azienda)"
                      className={combinedClass}
                      menuIsOpen={true}
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`${combinedClass} text-emerald-900 font-semibold`}>Owner (Azienda)</span>
                      <Search
                        className="w-4 h-4 text-emerald-700 cursor-pointer hover:text-emerald-900"
                        onClick={() => setSearchingColumn('ownerAzienda')}
                      />
                    </div>
                  )}
                </div>
                <div className="bg-emerald-100 sticky top-0 z-10 border border-emerald-200 p-1.5">
                  {searchingColumn === 'ownerCliente' ? (
                    <OmniaSelect
                      variant="light"
                      options={prepareOptionsWithAll(availableOwnerClients)}
                      value={selectedOwnerClient || null}
                      onChange={(value) => handleColumnChange('ownerCliente', value, setSelectedOwnerClient)}
                      onBlur={() => setSearchingColumn(null)}
                      onMenuClose={() => setSearchingColumn(null)}
                      placeholder="Owner (Cliente)"
                      className={combinedClass}
                      menuIsOpen={true}
                      autoFocus
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`${combinedClass} text-emerald-900 font-semibold`}>Owner (Cliente)</span>
                      <Search
                        className="w-4 h-4 text-emerald-700 cursor-pointer hover:text-emerald-900"
                        onClick={() => setSearchingColumn('ownerCliente')}
                      />
                    </div>
                  )}
                </div>
                {/* Empty state */}
                {sortedFilteredProjects.length === 0 && (
                  <>
                    <div className="col-span-6 text-center py-4 text-slate-400 border border-emerald-200">
                      Nessun progetto trovato
                    </div>
                  </>
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
                    const isRecovered = projectViewType === 'recovered';
                    const projectId = (proj._id || proj.projectId) as string;
                    const isHovered = hoveredRowId === projectId;
                    const isLoading = loadingProjectId === projectId;
                    const projectName = proj.projectName || proj.name || '(senza nome)';

                    // Gestione versione: per ora mostriamo solo versione corrente se esiste
                    const currentVersion = proj.version || '1.0';
                    const versionQualifier = proj.versionQualifier || 'production';
                    const versionDisplay = versionQualifier !== 'production'
                      ? `${currentVersion}-${versionQualifier}`
                      : currentVersion;
                    const availableVersions = [versionDisplay]; // TODO: Caricare versioni multiple dal backend
                    const isVersionMenuOpen = openVersionMenuId === projectId;

                    return (
                      <React.Fragment key={proj._id}>
                        {/* Cliente */}
                        <div
                          className={`border border-emerald-200 p-1.5 text-left ${combinedClass} ${isLoading ? 'bg-black/10' : ''} ${isHovered ? 'bg-emerald-50' : ''} cursor-pointer`}
                          onMouseEnter={() => setHoveredRowId(projectId)}
                          onMouseLeave={(e) => {
                            const relatedTarget = e.relatedTarget as HTMLElement;
                            if (relatedTarget && relatedTarget.closest('.action-buttons-container')) {
                              return;
                            }
                            if (!isLoading) {
                              setHoveredRowId(null);
                            }
                          }}
                          onClick={async () => {
                            if (!isLoading) {
                              setLoadingProjectId(projectId);
                              try {
                                const maybe = onSelectProject(projectId);
                                if ((maybe as any)?.then) await (maybe as any);
                              } catch (e) {
                                setLoadingProjectId(null);
                              }
                            }
                          }}
                        >
                          <div className="flex items-center gap-1.5">
                            <Building2 className={`w-4 h-4 flex-shrink-0 ${clientInfo.isGrey ? 'text-gray-400' : 'text-emerald-700'}`} />
                            <span className={`${clientInfo.isGrey ? 'text-gray-500' : 'text-emerald-900'} break-words`}>
                              {clientInfo.text}
                            </span>
                          </div>
                        </div>
                        {/* Progetto */}
                        <div
                          className={`border border-emerald-200 p-1.5 text-left ${combinedClass} ${isLoading ? 'bg-black/10' : ''} ${isHovered ? 'bg-emerald-50' : ''} cursor-pointer relative`}
                          onMouseEnter={() => setHoveredRowId(projectId)}
                          onMouseLeave={(e) => {
                            const relatedTarget = e.relatedTarget as HTMLElement;
                            if (relatedTarget && relatedTarget.closest('.action-buttons-container') ||
                                relatedTarget && relatedTarget.closest('.version-menu-container') ||
                                relatedTarget && relatedTarget.closest('.version-badge')) {
                              return;
                            }
                            if (!isLoading) {
                              setHoveredRowId(null);
                              setOpenVersionMenuId(null);
                            }
                          }}
                          onClick={async (e) => {
                            // Non aprire progetto se si clicca sul badge versione
                            if ((e.target as HTMLElement).closest('.version-badge') ||
                                (e.target as HTMLElement).closest('.version-menu-container')) {
                              return;
                            }
                            if (!isLoading) {
                              setLoadingProjectId(projectId);
                              try {
                                const maybe = onSelectProject(projectId);
                                if ((maybe as any)?.then) await (maybe as any);
                              } catch (e) {
                                setLoadingProjectId(null);
                              }
                            }
                          }}
                        >
                          {isLoading ? (
                            <div className="flex items-center gap-2 bg-black/20 rounded p-2">
                              <Loader2 className="w-4 h-4 animate-spin text-emerald-700 flex-shrink-0" />
                              <span className="text-emerald-900 break-words">
                                Caricando {projectName}
                                <span className="animate-pulse">...</span>
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Folder className={`w-4 h-4 flex-shrink-0 ${isRecovered ? 'text-red-600' : 'text-emerald-900'}`} />
                              <span className="text-emerald-900 break-words">{projectName}</span>
                              <div className="flex items-center gap-1 version-badge" onClick={(e) => e.stopPropagation()}>
                                <span
                                  className={`text-xs font-medium px-2 py-0.5 rounded cursor-pointer transition-colors ${
                                    versionQualifier === 'production'
                                      ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                      : versionQualifier === 'rc'
                                      ? 'text-orange-700 bg-orange-50 hover:bg-orange-100'
                                      : versionQualifier === 'beta'
                                      ? 'text-yellow-700 bg-yellow-50 hover:bg-yellow-100'
                                      : 'text-purple-700 bg-purple-50 hover:bg-purple-100'
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (availableVersions.length > 1) {
                                      setOpenVersionMenuId(isVersionMenuOpen ? null : projectId);
                                    }
                                  }}
                                >
                                  {versionDisplay}
                                </span>
                                {availableVersions.length > 1 && (
                                  <ChevronDown
                                    className={`w-3 h-3 text-slate-400 transition-transform cursor-pointer ${isVersionMenuOpen ? 'rotate-180' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenVersionMenuId(isVersionMenuOpen ? null : projectId);
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                          )}

                          {/* Menu a tendina versioni */}
                          {isVersionMenuOpen && availableVersions.length > 1 && (
                            <div
                              className="version-menu-container absolute left-1.5 top-full mt-1 bg-white border border-slate-300 rounded shadow-lg z-20 min-w-[120px]"
                              onMouseEnter={() => setOpenVersionMenuId(projectId)}
                              onMouseLeave={() => setOpenVersionMenuId(null)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {availableVersions.map((v) => (
                                <div
                                  key={v}
                                  className={`px-2 py-1.5 hover:bg-emerald-50 cursor-pointer text-sm ${
                                    v === versionDisplay ? 'bg-emerald-50 font-medium' : ''
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // TODO: Implementare cambio versione
                                    console.log('Cambio versione progetto', projectId, 'a:', v);
                                    setOpenVersionMenuId(null);
                                  }}
                                >
                                  {v}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Industry */}
                        <div
                          className={`border border-emerald-200 p-1.5 text-left text-slate-600 ${combinedClass} ${isLoading ? 'bg-black/10' : ''} ${isHovered ? 'bg-emerald-50' : ''} cursor-pointer`}
                          onMouseEnter={() => setHoveredRowId(projectId)}
                          onMouseLeave={(e) => {
                            const relatedTarget = e.relatedTarget as HTMLElement;
                            if (relatedTarget && relatedTarget.closest('.action-buttons-container')) {
                              return;
                            }
                            if (!isLoading) {
                              setHoveredRowId(null);
                            }
                          }}
                          onClick={async () => {
                            if (!isLoading) {
                              setLoadingProjectId(projectId);
                              try {
                                const maybe = onSelectProject(projectId);
                                if ((maybe as any)?.then) await (maybe as any);
                              } catch (e) {
                                setLoadingProjectId(null);
                              }
                            }
                          }}
                        >
                          <span className="break-words">{industryValue || '-'}</span>
                        </div>
                        {/* Data */}
                        <div
                          className={`border border-emerald-200 p-1.5 text-left text-slate-600 ${combinedClass} ${isLoading ? 'bg-black/10' : ''} ${isHovered ? 'bg-emerald-50' : ''} cursor-pointer`}
                          onMouseEnter={() => setHoveredRowId(projectId)}
                          onMouseLeave={(e) => {
                            const relatedTarget = e.relatedTarget as HTMLElement;
                            if (relatedTarget && relatedTarget.closest('.action-buttons-container')) {
                              return;
                            }
                            if (!isLoading) {
                              setHoveredRowId(null);
                            }
                          }}
                          onClick={async () => {
                            if (!isLoading) {
                              setLoadingProjectId(projectId);
                              try {
                                const maybe = onSelectProject(projectId);
                                if ((maybe as any)?.then) await (maybe as any);
                              } catch (e) {
                                setLoadingProjectId(null);
                              }
                            }
                          }}
                        >
                          <span className="break-words">{projectDate}</span>
                        </div>
                        {/* Owner (Azienda) */}
                        <div
                          className={`border border-emerald-200 p-1.5 text-left text-slate-600 ${combinedClass} ${isLoading ? 'bg-black/10' : ''} ${isHovered ? 'bg-emerald-50' : ''} cursor-pointer`}
                          onMouseEnter={() => setHoveredRowId(projectId)}
                          onMouseLeave={(e) => {
                            const relatedTarget = e.relatedTarget as HTMLElement;
                            if (relatedTarget && relatedTarget.closest('.action-buttons-container')) {
                              return;
                            }
                            if (!isLoading) {
                              setHoveredRowId(null);
                            }
                          }}
                          onClick={async () => {
                            if (!isLoading) {
                              setLoadingProjectId(projectId);
                              try {
                                const maybe = onSelectProject(projectId);
                                if ((maybe as any)?.then) await (maybe as any);
                              } catch (e) {
                                setLoadingProjectId(null);
                              }
                            }
                          }}
                        >
                          <span className="break-words">{ownerCompany || '-'}</span>
                        </div>
                        {/* Owner (Cliente) */}
                        <div
                          className={`border border-emerald-200 p-1.5 text-left text-slate-600 ${combinedClass} ${isLoading ? 'bg-black/10' : ''} ${isHovered ? 'bg-emerald-50' : ''} cursor-pointer relative`}
                          onMouseEnter={() => setHoveredRowId(projectId)}
                          onMouseLeave={(e) => {
                            const relatedTarget = e.relatedTarget as HTMLElement;
                            if (relatedTarget && relatedTarget.closest('.action-buttons-container')) {
                              return;
                            }
                            if (!isLoading) {
                              setHoveredRowId(null);
                            }
                          }}
                          onClick={async () => {
                            if (!isLoading) {
                              setLoadingProjectId(projectId);
                              try {
                                const maybe = onSelectProject(projectId);
                                if ((maybe as any)?.then) await (maybe as any);
                              } catch (e) {
                                setLoadingProjectId(null);
                              }
                            }
                          }}
                        >
                          <span className="break-words">
                            {(() => {
                              const ownerClient = (proj.ownerClient || '').toString().trim();
                              return (!ownerClient || ownerClient === 'undefined' || ownerClient === 'null') ? '-' : ownerClient;
                            })()}
                          </span>
                          {/* Toolbar azioni - posizionata assolutamente fuori dalla griglia */}
                          {isHovered && !isLoading && (
                            <div
                              className="action-buttons-container flex flex-row gap-2 z-20 absolute"
                              data-row-id={projectId}
                              onClick={(e) => e.stopPropagation()}
                              onMouseEnter={() => setHoveredRowId(projectId)}
                              onMouseLeave={(e) => {
                                const relatedTarget = e.relatedTarget as HTMLElement;
                                if (relatedTarget && relatedTarget.closest('[data-row-id]')) {
                                  return;
                                }
                                setHoveredRowId(null);
                              }}
                              style={{
                                pointerEvents: 'auto',
                                right: '-60px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                              }}
                            >
                              {/* Pulsante Apri */}
                              <button
                                className="bg-transparent hover:bg-emerald-100 text-emerald-700 p-1 rounded transition-colors flex-shrink-0"
                                title="Apri progetto"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setLoadingProjectId(projectId);
                                  try {
                                    const maybe = onSelectProject(projectId);
                                    if ((maybe as any)?.then) await (maybe as any);
                                  } catch (e) {
                                    setLoadingProjectId(null);
                                  }
                                }}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                              {/* Pulsante Elimina */}
                              {confirmingDeleteId === projectId ? (
                                <div className="flex flex-row gap-1 items-center">
                                  <button
                                    className="bg-red-600 text-white px-2 py-1 rounded text-xs font-semibold hover:bg-red-700 transition-colors"
                                    title="Conferma eliminazione"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setDeletingId(projectId);
                                      setConfirmingDeleteId(null);
                                      try {
                                        await onDeleteProject(projectId);
                                      } finally {
                                        setDeletingId(null);
                                      }
                                    }}
                                  >
                                    Conferma
                                  </button>
                                  <button
                                    className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs font-semibold hover:bg-gray-300 transition-colors"
                                    title="Annulla eliminazione"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmingDeleteId(null);
                                    }}
                                  >
                                    Annulla
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="bg-transparent hover:bg-red-100 text-red-600 p-1 rounded transition-colors flex-shrink-0"
                                  title="Elimina progetto"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmingDeleteId(projectId);
                                  }}
                                >
                                  {deletingId === projectId
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <Trash2 className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })}
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