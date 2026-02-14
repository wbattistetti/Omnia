import React, { useState } from 'react';
import { enableDebug } from '../utils/logger';
import { ProjectDataProvider } from '../context/ProjectDataContext';
import { ProjectData } from '../types/project';
import { AppContent } from './AppContent';
// ✅ REMOVED: ActionsCatalogContext - tasks are now loaded directly in ResponseEditor
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TaskTreeProvider } from '../context/DDTContext';
import { TaskTreeManagerProvider } from '../context/DDTManagerContext';
import { ProjectTranslationsProvider } from '../context/ProjectTranslationsContext';
import { ThemeProvider } from '../theme/components/ThemeProvider';
import { TaskEditorProvider } from './TaskEditor/EditorHost/TaskEditorContext'; // ✅ RINOMINATO: ActEditor → TaskEditor, ActEditorProvider → TaskEditorProvider
import { SpeechRecognitionProvider } from '../context/SpeechRecognitionContext';
import { AIProviderProvider } from '../context/AIProviderContext';
import { InMemoryConditionsProvider } from '../context/InMemoryConditionsContext';
import { BackendTypeProvider } from '../context/BackendTypeContext';
import { EngineTypeProvider } from '../context/EngineTypeContext';
import { TypeTemplateService } from '../services/TypeTemplateService';
import { taskTemplateService } from '../services/TaskTemplateService';
import { DialogueTaskService } from '../services/DialogueTaskService';
import { TemplateTranslationsService } from '../services/TemplateTranslationsService';
import { useLanguageChange } from '../hooks/useLanguageChange';
import { MissingTranslationsDialog } from './common/MissingTranslationsDialog';
import { generateMissingTranslations, type MissingTranslation } from '../services/TranslationIntegrityService';
import { GlobalTestPanelProvider } from '@context/GlobalTestPanelContext';
import { GlobalTestPanel } from '@components/GlobalTestPanel/GlobalTestPanel';

type AppState = 'landing' | 'creatingProject' | 'mainApp';

function AppInner() {
  const [appState, setAppState] = useState<AppState>('landing');
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // Inizia chiusa di default
  // Note: avoid reading ProjectData context here to keep HMR boundaries stable

  // ✅ NEW: Missing translations dialog state
  const [missingTranslations, setMissingTranslations] = useState<MissingTranslation[]>([]);
  const [showMissingDialog, setShowMissingDialog] = useState(false);
  const [isGeneratingTranslations, setIsGeneratingTranslations] = useState(false);

  // ✅ NEW: Handle missing translations found
  const handleMissingFound = async (missing: MissingTranslation[]): Promise<boolean> => {
    setMissingTranslations(missing);
    setShowMissingDialog(true);
    // Return false to prevent auto-generation - user will decide via dialog
    return false;
  };

  // ✅ NEW: Generate translations from dialog
  const handleGenerateTranslations = async () => {
    if (missingTranslations.length === 0) return;

    setIsGeneratingTranslations(true);
    try {
      const targetLanguage = missingTranslations[0]?.targetLanguage || 'en';
      const sourceLanguage = missingTranslations[0]?.sourceLanguage || 'it';
      const missingIds = missingTranslations.map(m => m.guid);

      const result = await generateMissingTranslations(missingIds, targetLanguage, sourceLanguage);

      if (result.success) {
        console.log('[App] Translations generated successfully', {
          generated: result.generated,
          errors: result.errors,
        });
        // Reload translations cache
        await TemplateTranslationsService.reloadAll();
      } else {
        console.error('[App] Failed to generate translations', result.errors);
        alert(`Failed to generate some translations. ${result.errors?.join(', ')}`);
      }
    } catch (error) {
      console.error('[App] Error generating translations:', error);
      alert(`Error generating translations: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsGeneratingTranslations(false);
    }
  };

  // ✅ NEW: Monitor language changes
  useLanguageChange({
    onMissingFound: handleMissingFound,
    enabled: appState === 'mainApp', // Only check when in main app
  });

  // ✅ REMOVED: Tasks are now loaded directly in ResponseEditor, not in App.tsx

  // Enable central logger globally for this session
  React.useEffect(() => {
    try {
      enableDebug();
      (window as any).Logger?.setLevel('debug');
      (window as any).Logger?.enableComponent('ALL');
    } catch { }
  }, []);

  // Load act type patterns from database at startup
  React.useEffect(() => {
    import('../nlp/taskType/registry').then(module => { // ✅ RINOMINATO: actType → taskType
      module.initializeRegistry().catch(err => {
        console.warn('[App] Failed to load act type patterns from database, using fallback:', err);
      });
    });
  }, []);

  // ✅ Precarica tutte le cache in parallelo all'avvio (non blocca il rendering)
  React.useEffect(() => {
    // Ottieni lingua del progetto corrente
    const projectLang = (localStorage.getItem('project.lang') || 'it') as 'it' | 'en' | 'pt';

    Promise.all([
      TypeTemplateService.loadTemplates().catch(() => null),
      DialogueTaskService.loadTemplates().catch(() => []),
      taskTemplateService.getAllTemplates().catch(() => null),
      TemplateTranslationsService.loadForLanguage(projectLang).catch(() => null),
      import('../services/DDTPatternService').then(module => module.DDTPatternService.loadPatterns().catch(() => ({})))
    ]).catch(() => {
      // Silently handle errors - cache preload is non-critical
    });
  }, []); // Solo all'avvio

  return (
    <GlobalTestPanelProvider>
      <AppContent
        appState={appState}
        setAppState={setAppState}
        currentProject={currentProject}
        setCurrentProject={(project) => setCurrentProject(project as any)}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        testPanelOpen={false}
        setTestPanelOpen={() => {}}
        testNodeId={null}
        setTestNodeId={() => {}}
        onPlayNode={() => {}}
      />

      {/* ✅ NEW: Missing translations dialog */}
      <MissingTranslationsDialog
        open={showMissingDialog}
        onClose={() => setShowMissingDialog(false)}
        missing={missingTranslations}
        onGenerate={handleGenerateTranslations}
        isGenerating={isGeneratingTranslations}
      />

      {/* ✅ NEW: Global Test Panel (full height, right side) */}
      <GlobalTestPanel />
    </GlobalTestPanelProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ProjectDataProvider>
        <ProjectTranslationsProvider>
          <AIProviderProvider>
            <DndProvider backend={HTML5Backend}>
              <SpeechRecognitionProvider>
                <TaskTreeProvider>
                  <TaskTreeManagerProvider>
                    <TaskEditorProvider> {/* ✅ RINOMINATO: ActEditorProvider → TaskEditorProvider */}
                      <InMemoryConditionsProvider>
                        <BackendTypeProvider>
                          <EngineTypeProvider>
                            <AppInner />
                          </EngineTypeProvider>
                        </BackendTypeProvider>
                      </InMemoryConditionsProvider>
                    </TaskEditorProvider> {/* ✅ RINOMINATO: ActEditorProvider → TaskEditorProvider */}
                  </TaskTreeManagerProvider>
                </TaskTreeProvider>
              </SpeechRecognitionProvider>
            </DndProvider>
        </AIProviderProvider>
        </ProjectTranslationsProvider>
      </ProjectDataProvider>
    </ThemeProvider>
  );
}