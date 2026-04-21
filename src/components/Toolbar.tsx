import { useState, useRef, useEffect, useReducer } from 'react';
import { Home, Save, Settings, Loader2, CheckCircle, AlertCircle, X, Upload, Copy, ChevronDown, Database, BookOpen } from 'lucide-react';
import { ProjectData } from '../types/project';
import DeploymentDialog, { type DeploymentConfig } from './TaskEditor/ResponseEditor/Deployment/DeploymentDialog';
import { FlowWorkspaceSnapshot } from '../flows/FlowWorkspaceSnapshot';
import { useFlowchartState } from '../context/FlowchartStateContext';
import { VersionInput } from './common/VersionInput';
import { isValidVersion, getNextMinor, getNextMajor } from '../utils/versionUtils';
import { catalogToExistingEntries, validateSaveAs, type ExistingVersionEntry, type ValidateSaveAsResult } from '../utils/saveAsValidation';

const BTN_BASE = 'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200';
const BTN_SECONDARY = 'bg-slate-700 hover:bg-slate-600 text-slate-200';
const BTN_PRIMARY_SAVE = 'bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-60';
const BTN_SAVE_AS = 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-purple-500/50';
const BTN_DEPLOY = 'bg-blue-600 hover:bg-blue-700 text-white';
const BTN_RUN = 'bg-green-600 hover:bg-green-700 text-white';
const GUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

function sanitizeRunFlowTitle(rawTitle: string | null | undefined, flowId: string): string {
  const title = (rawTitle || '').trim();
  if (flowId === 'main') return 'MAIN';
  if (!title) return 'Subflow';
  const lower = title.toLowerCase();
  if (lower.startsWith('subflow_')) return 'Subflow';
  if (GUID_RE.test(title)) return 'Subflow';
  return title;
}

export interface SaveAsPayload {
  name: string;
  version: string;
  versionQualifier: 'alpha' | 'beta' | 'rc' | 'production';
  clientName?: string;
}

export interface ToolbarProps {
  onHome: () => void;
  onSave: () => void | Promise<void>;
  onRun: () => void;
  onSettings: () => void;
  currentProject?: ProjectData | null;
  isSaving?: boolean;
  saveSuccess?: boolean;
  saveError?: string | null;
  onCloseProject?: () => void;
  currentProjectId?: string | null;
  /** Apri progetto: torna alla landing per scegliere un altro progetto. Se non passato, usa onHome. */
  onOpenProject?: () => void;
  /** Salva come: salva con nuovo nome/versione (dialog). Se non passato, la voce "Salva come…" nel menu non viene mostrata. */
  onSaveAs?: (payload: SaveAsPayload) => void | Promise<void>;
  /** Crea nuovo progetto come versione minor (clone + apertura). Se non passato, la voce non viene mostrata. */
  onSaveAsNewMinor?: () => void | Promise<void>;
  /** Crea nuovo progetto come versione major (clone + apertura). Se non passato, la voce non viene mostrata. */
  onSaveAsNewMajor?: () => void | Promise<void>;
  /** Se false, le voci "Crea nuova minor/major" sono disabilitate (solo sull'ultima versione sono attive). */
  isLatestVersion?: boolean;
  /** Ultima versione disponibile (stesso progetto); mostrata quando non sei sull'ultima. */
  latestVersion?: string | null;
  /** Catalogo progetti per validazione "Salva come" (nome, cliente, versione univoci e lineari). */
  existingProjectsForSaveAs?: Array<{ projectName?: string; name?: string; clientName?: string; version?: string }>;
  /** Pannello variabili globali di progetto (toolbar principale). */
  globalDataOpen?: boolean;
  onGlobalDataToggle?: () => void;
  /** Apre la sidebar Library (template / libreria task). */
  onOpenLibrary?: () => void;
}

export function Toolbar({
  onHome,
  onSave,
  isSaving = false,
  saveSuccess = false,
  saveError = null,
  onRun,
  onSettings,
  currentProject,
  onCloseProject,
  currentProjectId,
  onOpenProject: _onOpenProject,
  onSaveAs,
  onSaveAsNewMinor,
  onSaveAsNewMajor,
  isLatestVersion = true,
  latestVersion = null,
  existingProjectsForSaveAs = [],
  globalDataOpen = false,
  onGlobalDataToggle,
  onOpenLibrary,
}: ToolbarProps) {
  // ✅ DEBUG: Log component mount and props (log removed to reduce noise)
  // React.useEffect(() => {
  //   console.log('[Toolbar] 🎨 Component mounted/updated:', {
  //     hasOnRun: typeof onRun === 'function',
  //     onRunType: typeof onRun,
  //     currentProjectId,
  //     hasCurrentProject: !!currentProject,
  //     isProjectEmpty: !currentProject || !currentProjectId,
  //   });
  // }, [onRun, currentProjectId, currentProject]);
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  // ✅ Deployment dialog state
  const [isDeploymentDialogOpen, setIsDeploymentDialogOpen] = useState(false);
  const projectLocale = 'it-IT'; // TODO: Get from project context if available

  // ✅ FLOWCHART STATE: Get nodes state from context
  const { hasNodes: hasFlowchartNodes } = useFlowchartState();

  const [, bumpFlowSnapshot] = useReducer((n: number) => n + 1, 0);
  useEffect(() => FlowWorkspaceSnapshot.subscribe(() => bumpFlowSnapshot()), []);

  const activeFlowId = FlowWorkspaceSnapshot.getActiveFlowId();
  const activeFlowSlice = FlowWorkspaceSnapshot.getFlowById(activeFlowId);
  const activeFlowTitle = sanitizeRunFlowTitle(activeFlowSlice?.title || activeFlowId, activeFlowId);
  const isMainCanvasActive = activeFlowId === 'main';
  const runButtonLabel = isMainCanvasActive ? 'Run MAIN' : `Run ${activeFlowTitle}`;

  const runFlowWithRoot = (root: 'main' | 'active') => {
    try {
      localStorage.setItem('flow.orchestratorRoot', root);
    } catch {
      /* noop */
    }
    onRun();
  };

  const runFlowDefault = () => {
    runFlowWithRoot(isMainCanvasActive ? 'main' : 'active');
  };

  // Verifica se il progetto è vuoto (non ha contenuti)
  // Check both project data and flowchart nodes/edges
  const hasFlowchartContent =
    FlowWorkspaceSnapshot.getNodes().length > 0 ||
    (FlowWorkspaceSnapshot.getFlowById('main')?.nodes?.length || 0) > 0;

  const isProjectEmpty = !currentProject ||
    (!currentProject.taskTemplates?.length &&
     !currentProject.userActs?.length &&
     !currentProject.backendActions?.length &&
     !currentProject.conditions?.length &&
     !currentProject.macrotasks?.length &&
     !hasFlowchartContent);

  // Chiudi menu Salva quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        saveMenuRef.current &&
        !saveMenuRef.current.contains(event.target as Node) &&
        saveButtonRef.current &&
        !saveButtonRef.current.contains(event.target as Node)
      ) {
        setShowSaveMenu(false);
      }
    };

    if (showSaveMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSaveMenu]);

  const versionDisplay = (): string => {
    if (!currentProject) return '–';
    const v = currentProject.version || '1.0';
    const q = currentProject.versionQualifier;
    if (q && q !== 'production') return `${v}-${q}`;
    return v;
  };

  const renderProjectInfo = () => {
    if (!currentProject) {
      return <span className="text-slate-400">Nessun progetto aperto</span>;
    }
    const name = (currentProject.name || '').trim() || '–';
    const version = versionDisplay();
    const client = (currentProject.clientName || '').trim() || '–';
    return (
      <>
        <span className="text-slate-300">Progetto: </span>
        <span className="text-emerald-400 font-medium">{name}</span>
        <span className="text-slate-400 mx-1">v</span>
        <span className="text-emerald-400/90">{version}</span>
        <span className="text-slate-500 mx-2">–</span>
        <span className="text-slate-300">Cliente: </span>
        <span className="text-emerald-400 font-medium">{client}</span>
      </>
    );
  };

  return (
    <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center gap-3 min-w-0">
      {/* Sinistra: Home + label progetto + Chiudi + Salva (icona dischetto) */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          onClick={onHome}
          className="flex items-center justify-center w-10 h-10 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors flex-shrink-0"
          title="Torna alla pagina principale"
        >
          <Home className="w-4 h-4" />
        </button>
        <div className="text-sm min-w-0 truncate flex-shrink">
          {renderProjectInfo()}
        </div>
        {currentProject && onCloseProject && (
          <button
            type="button"
            onClick={onCloseProject}
            className={`${BTN_BASE} ${BTN_SECONDARY} flex-shrink-0`}
            title="Chiudi progetto e torna alla home"
          >
            <X className="w-4 h-4 flex-shrink-0" />
            <span>Chiudi</span>
          </button>
        )}
        {currentProjectId && onOpenLibrary && (
          <button
            type="button"
            onClick={onOpenLibrary}
            className={`${BTN_BASE} ${BTN_SECONDARY} flex-shrink-0`}
            title="Apri Library"
            aria-label="Apri Library"
          >
            <BookOpen className="w-4 h-4 flex-shrink-0" strokeWidth={2} aria-hidden />
            <span>Library</span>
          </button>
        )}
        {currentProjectId && onGlobalDataToggle && (
          <button
            type="button"
            onClick={onGlobalDataToggle}
            className={`${BTN_BASE} flex-shrink-0 ${
              globalDataOpen ? 'bg-teal-700 hover:bg-teal-600 text-white border border-teal-500/50' : BTN_SECONDARY
            }`}
            title="Dati globali del progetto (visibili in tutti i flow)"
            aria-pressed={globalDataOpen}
          >
            <Database className="w-4 h-4 flex-shrink-0" strokeWidth={2} aria-hidden />
            <span>Global Data</span>
          </button>
        )}
        <div className="relative flex-shrink-0" ref={saveMenuRef}>
          <button
            ref={saveButtonRef}
            onClick={() => (currentProject ? setShowSaveMenu((v) => !v) : onSave())}
            disabled={isSaving}
            className={`${BTN_BASE} ${BTN_PRIMARY_SAVE} relative`}
            title="Salva"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            ) : (
              <Save className="w-4 h-4 flex-shrink-0" strokeWidth={2} aria-hidden />
            )}
            <span>Salva</span>
            {currentProject && (
              <ChevronDown className={`w-4 h-4 transition-transform ${showSaveMenu ? 'rotate-180' : ''}`} />
            )}
            {!isSaving && saveSuccess && <CheckCircle className="w-4 h-4 text-green-400" />}
            {saveError && (
              <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 bg-red-600 text-white text-xs rounded px-2 py-1 shadow z-20 whitespace-nowrap flex items-center gap-1">
                <AlertCircle className="w-4 h-4 mr-1" /> {saveError}
              </span>
            )}
          </button>
          {showSaveMenu && currentProject && (
            <div className="absolute left-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50 min-w-[260px] py-1">
              <div className="px-4 py-2 border-b border-slate-600/80 space-y-0.5">
                <div className="text-xs text-slate-400">
                  Versione corrente: <span className="text-slate-200 font-medium">{currentProject?.version?.trim() && isValidVersion(currentProject.version) ? currentProject.version : '1.0'}</span>
                </div>
                {!isLatestVersion && latestVersion && (
                  <div className="text-xs text-amber-400/90">
                    Ultima versione disponibile: <span className="font-medium">{latestVersion}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSaveMenu(false);
                  onSave();
                }}
                disabled={isSaving}
                className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Salva versione corrente
              </button>
              {onSaveAsNewMinor && (() => {
                const current = currentProject?.version?.trim() && isValidVersion(currentProject.version) ? currentProject.version : '1.0';
                const next = getNextMinor(current);
                const disabled = !isLatestVersion;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (disabled) return;
                      setShowSaveMenu(false);
                      onSaveAsNewMinor();
                    }}
                    disabled={disabled}
                    title={disabled ? 'Disponibile solo sull\'ultima versione' : undefined}
                    className={`w-full px-4 py-2 text-left text-sm flex flex-col items-start gap-0.5 ${disabled ? 'text-slate-500 cursor-not-allowed' : 'text-slate-200 hover:bg-slate-700'}`}
                  >
                    <span className="flex items-center gap-2">
                      <Copy className="w-4 h-4 flex-shrink-0" />
                      Crea nuova minor
                    </span>
                    <span className="text-xs text-slate-400 pl-6">{current} → {next}</span>
                  </button>
                );
              })()}
              {onSaveAsNewMajor && (() => {
                const current = currentProject?.version?.trim() && isValidVersion(currentProject.version) ? currentProject.version : '1.0';
                const next = getNextMajor(current);
                const disabled = !isLatestVersion;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (disabled) return;
                      setShowSaveMenu(false);
                      onSaveAsNewMajor();
                    }}
                    disabled={disabled}
                    title={disabled ? 'Disponibile solo sull\'ultima versione' : undefined}
                    className={`w-full px-4 py-2 text-left text-sm flex flex-col items-start gap-0.5 ${disabled ? 'text-slate-500 cursor-not-allowed' : 'text-slate-200 hover:bg-slate-700'}`}
                  >
                    <span className="flex items-center gap-2">
                      <Copy className="w-4 h-4 flex-shrink-0" />
                      Crea nuova major
                    </span>
                    <span className="text-xs text-slate-400 pl-6">{current} → {next}</span>
                  </button>
                );
              })()}
              {onSaveAs && (
                <button
                  type="button"
                  onClick={() => {
                    setShowSaveMenu(false);
                    setShowSaveAsDialog(true);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Salva come…
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Destra: separatore, Deployment, Impostazioni, toolbar esecuzione flusso */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-px h-8 bg-slate-600 self-center" aria-hidden />
        {currentProjectId && (
          <button
            type="button"
            onClick={() => setIsDeploymentDialogOpen(true)}
            className={`${BTN_BASE} ${BTN_DEPLOY}`}
            title="Deploy traduzioni su Redis"
          >
            <Upload className="w-4 h-4 flex-shrink-0" />
            <span>Deployment</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => onSettings()}
          className="flex items-center justify-center w-10 h-10 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors duration-200"
          title="Impostazioni Omnia"
        >
          <Settings className="w-4 h-4" />
        </button>

        {hasFlowchartNodes && onRun && (
          <button
            type="button"
            onClick={() => {
              if (typeof onRun !== 'function') return;
              runFlowDefault();
            }}
            className={`${BTN_BASE} ${BTN_RUN} flex-shrink-0`}
            title={isMainCanvasActive ? 'Esegui MAIN' : `Esegui ${activeFlowTitle}`}
          >
            <span className="max-w-[18rem] truncate">{runButtonLabel}</span>
          </button>
        )}
      </div>

      {/* Deployment Dialog */}
      {isDeploymentDialogOpen && (
        <DeploymentDialog
          isOpen={isDeploymentDialogOpen}
          onClose={() => setIsDeploymentDialogOpen(false)}
          projectId={currentProjectId || null}
          locale={projectLocale}
          onDeploy={async (config: DeploymentConfig) => {
            const response = await fetch(`http://localhost:3100/api/deploy/sync-translations`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(config)
            });

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Deployment failed: ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            if (config.verifyAfterDeploy) {
              const verifyResponse = await fetch(`http://localhost:3100/api/deploy/verify-redis?projectId=${config.projectId}&locale=${config.locale}`);
              if (verifyResponse.ok) {
                const verifyResult = await verifyResponse.json();
                if (!verifyResult.consistent) {
                  throw new Error(`Verification failed: ${verifyResult.missingCount} translations missing`);
                }
              }
            }
          }}
        />
      )}

      {/* Salva come Dialog */}
      {showSaveAsDialog && currentProject && onSaveAs && (
        <SaveAsDialog
          currentName={currentProject.name || ''}
          currentVersion={currentProject.version || '1.0'}
          currentQualifier={currentProject.versionQualifier || 'production'}
          currentClientName={currentProject.clientName || ''}
          existingEntries={catalogToExistingEntries(existingProjectsForSaveAs)}
          onClose={() => setShowSaveAsDialog(false)}
          onConfirm={(payload) => {
            onSaveAs(payload);
            setShowSaveAsDialog(false);
          }}
        />
      )}
    </div>
  );
}

interface SaveAsDialogProps {
  currentName: string;
  currentVersion: string;
  currentQualifier: 'alpha' | 'beta' | 'rc' | 'production';
  currentClientName: string;
  existingEntries: ExistingVersionEntry[];
  onClose: () => void;
  onConfirm: (payload: SaveAsPayload) => void;
}

function SaveAsDialog({
  currentName,
  currentVersion,
  currentQualifier,
  currentClientName,
  existingEntries,
  onClose,
  onConfirm
}: SaveAsDialogProps) {
  const [name, setName] = useState(currentName);
  const [version, setVersion] = useState(currentVersion);
  const [versionQualifier, setVersionQualifier] = useState<'alpha' | 'beta' | 'rc' | 'production'>(currentQualifier);
  const [clientName, setClientName] = useState(currentClientName);

  const trimmedVersion = version.trim() || '1.0';
  const versionValid = isValidVersion(trimmedVersion);
  const parsed = versionValid ? (() => {
    const parts = trimmedVersion.split('.');
    return { major: Number(parts[0]), minor: Number(parts[1]) };
  })() : null;
  const currentParsed = (() => {
    const v = (currentVersion || '1.0').trim();
    if (!isValidVersion(v)) return { major: 0, minor: 0 };
    const parts = v.split('.');
    return { major: Number(parts[0]), minor: Number(parts[1]) };
  })();

  const validation = ((): ValidateSaveAsResult => {
    if (name.trim().length === 0) return { valid: false, error: 'Il nome progetto è obbligatorio.' };
    if (!versionValid || !parsed) return { valid: false, error: undefined };
    return validateSaveAs({
      projectName: name.trim(),
      clientName: (clientName || '').trim(),
      major: parsed.major,
      minor: parsed.minor,
      existingEntries,
      originalProjectName: currentName,
      originalClientName: currentClientName || '',
      currentMajor: currentParsed.major,
      currentMinor: currentParsed.minor,
    });
  })();

  const isSaveAsEnabled = name.trim().length > 0 && versionValid && validation.valid;
  const saveAsError = validation.valid ? null : validation.error;
  const suggestedVersion = parsed && validation.suggestedMinor !== undefined
    ? `${parsed.major}.${validation.suggestedMinor}`
    : null;

  const handleConfirm = () => {
    if (!isSaveAsEnabled) return;
    onConfirm({
      name: name.trim(),
      version: trimmedVersion,
      versionQualifier,
      clientName: clientName.trim() || undefined
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-600 rounded-xl shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Salva come</h3>
        <div className="space-y-4">
          {saveAsError && (
            <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
              {saveAsError}
              {validation.suggestedOpenVersion != null && (
                <span className="block mt-1 text-amber-300/90 text-xs">
                  Apri la versione {validation.suggestedOpenVersion} per poter creare la successiva.
                </span>
              )}
            </div>
          )}
          {suggestedVersion && (name.trim() === currentName.trim() && (clientName || '').trim() === (currentClientName || '').trim()) && (
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span>Prossima minor suggerita: <strong className="text-slate-300">{suggestedVersion}</strong></span>
              <button
                type="button"
                onClick={() => setVersion(suggestedVersion)}
                className="px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-slate-200 text-xs"
              >
                Usa {suggestedVersion}
              </button>
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nome progetto</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Nome progetto"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Versione</label>
            <VersionInput
              version={version}
              versionQualifier={versionQualifier}
              onVersionChange={setVersion}
              onQualifierChange={setVersionQualifier}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Cliente (opzionale)</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Nome cliente"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className={`${BTN_BASE} ${BTN_SECONDARY}`}
          >
            Annulla
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isSaveAsEnabled}
            className={`${BTN_BASE} ${BTN_PRIMARY_SAVE}`}
          >
            Salva come
          </button>
        </div>
      </div>
    </div>
  );
}