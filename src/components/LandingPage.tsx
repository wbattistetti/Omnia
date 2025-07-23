import React, { useState } from 'react';
import { HelpCircle, ChevronDown, XCircle, Trash2 } from 'lucide-react';

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
  onSelectProject: (id: string) => void;
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

  // Filtra progetti per ricerca nella modale
  const uniqueRecentProjects = Array.from(new Map(recentProjects.map(p => [p._id, p])).values());
  const uniqueAllProjects = Array.from(new Map(allProjects.map(p => [p._id, p])).values());
  const filteredAll = uniqueAllProjects.filter(
    (p) =>
      (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <div className="relative">
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
                    onClick={() => { setShowDropdown(false); setShowAllProjectsModal(true); }}
                  >
                    <span>Tutti i progetti</span>
                  </button>
                  <div className="my-2 border-t border-emerald-100" />
                  {/* Ultimi 10 progetti */}
                  {uniqueRecentProjects.length === 0 && (
                    <div className="text-slate-400 px-4 py-2">Nessun progetto recente</div>
                  )}
                  {uniqueRecentProjects.map((proj) => (
                    <div key={proj._id} className="flex items-center justify-between px-4 py-2 hover:bg-emerald-50 rounded group">
                      <button
                        className="text-left flex-1 truncate"
                        title={proj.name}
                        onClick={() => { setShowDropdown(false); onSelectProject(proj._id); }}
                      >
                        {proj.name || '(senza nome)'}
                      </button>
                      <span className="text-xs text-slate-400 ml-2">{proj.createdAt ? new Date(proj.createdAt).toLocaleDateString() : ''}</span>
                      <button
                        className="ml-2 text-red-500 opacity-70 hover:opacity-100"
                        title="Elimina progetto"
                        onClick={() => onDeleteProject(proj._id)}
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Pannello espanso sotto i pulsanti */}
          {showAllProjectsModal && (
            <div className="mt-8 w-full max-w-2xl bg-white rounded-xl shadow-2xl p-6 relative animate-fade-in">
              <button
                className="absolute top-3 right-3 text-emerald-800 hover:text-emerald-600 text-2xl"
                onClick={() => setShowAllProjectsModal(false)}
                title="Chiudi"
              >
                ×
              </button>
              <h2 className="text-xl font-bold mb-4 text-emerald-900">Tutti i progetti</h2>
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Cerca progetto..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="flex-1 border border-emerald-200 rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
                />
                <button
                  className="flex items-center gap-1 text-red-600 border border-red-200 rounded px-3 py-2 hover:bg-red-50 font-semibold"
                  onClick={() => setShowDeleteAllConfirm(true)}
                >
                  <Trash2 className="w-4 h-4" /> Elimina tutti
                </button>
              </div>
              {showDeleteAllConfirm && (
                <div className="mt-2 flex gap-2 items-center bg-red-50 border border-red-200 rounded px-3 py-2">
                  <button
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 font-semibold"
                    onClick={() => { setShowDeleteAllConfirm(false); onDeleteAllProjects(); }}
                  >
                    Conferma
                  </button>
                  <button
                    className="bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300 font-semibold"
                    onClick={() => setShowDeleteAllConfirm(false)}
                  >
                    Annulla
                  </button>
                </div>
              )}
              <div className="max-h-96 overflow-y-auto divide-y divide-emerald-50">
                {filteredAll.length === 0 && (
                  <div className="text-slate-400 px-4 py-8 text-center">Nessun progetto trovato</div>
                )}
                {filteredAll.map((proj) => (
                  <div key={proj._id} className="flex items-center justify-between px-2 py-2 hover:bg-emerald-50 rounded group">
                    <button
                      className="text-left flex-1 truncate"
                      title={proj.name}
                      onClick={() => { setShowAllProjectsModal(false); onSelectProject(proj._id); }}
                    >
                      {proj.name || '(senza nome)'}
                    </button>
                    <span className="text-xs text-slate-400 ml-2">{proj.createdAt ? new Date(proj.createdAt).toLocaleDateString() : ''}</span>
        <button
                      className="ml-2 text-red-500 opacity-70 hover:opacity-100"
                      title="Elimina progetto"
                      onClick={() => onDeleteProject(proj._id)}
        >
                      <XCircle className="w-5 h-5" />
        </button>
                  </div>
                ))}
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