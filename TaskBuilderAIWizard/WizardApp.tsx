import { useState, useEffect } from 'react';
// ❌ RIMOSSO: Sidebar nuovo (ora usiamo quello di ResponseEditor)
// import { Sidebar } from './components/Sidebar';
import { CenterPanel } from './components/CenterPanel';
import { RightPanel } from './components/RightPanel';
import { useWizardState } from './hooks/useWizardState';
import { useSimulation } from './hooks/useSimulation';
// ❌ RIMOSSO: useSidebarSync non più necessario
// import { useSidebarSync } from './hooks/useSidebarSync';
import { WizardTaskTreeNode } from './types';
// MOCK_MODULES removed - use real API endpoint when available
const EMPTY_MODULES: any[] = [];

export function WizardApp() {
  const {
    currentStep,
    setCurrentStep,
    userInput,
    setUserInput,
    dataSchema,
    setDataSchema,
    constraints,
    setConstraints,
    nlpContract,
    setNlpContract,
    messages,
    setMessages,
    speed,
    setSpeed,
    pipelineSteps,
    updatePipelineStep,
    resetPipeline,
    updateTaskPipelineStatus,
    updateTaskProgress,
    activeNodeId,
    setActiveNodeId,
    iconSize,
    setIconSize,
    selectedModuleId,
    setSelectedModuleId,
    showStructureConfirmation,
    setShowStructureConfirmation,
    structureConfirmed,
    setStructureConfirmed,
    showCorrectionMode,
    setShowCorrectionMode,
    correctionInput,
    setCorrectionInput
  } = useWizardState();

  const { runGenerationPipeline, continueAfterStructureConfirmation } = useSimulation({
    updatePipelineStep,
    setDataSchema,
    setConstraints,
    setNlpContract,
    setMessages,
    setCurrentStep,
    setShowStructureConfirmation,
    updateTaskPipelineStatus,
    updateTaskProgress
  });

  // ❌ RIMOSSO: useSidebarSync non più necessario (Sidebar gestito da ResponseEditor)
  // const { registerNode } = useSidebarSync(activeNodeId);
  const [previewModuleId, setPreviewModuleId] = useState<string | null>(null);

  // dataSchema è già un WizardTaskTreeNode[], quindi lo usiamo direttamente
  const taskTree: WizardTaskTreeNode[] = dataSchema;

  const handleStartGeneration = async () => {
    if (!userInput.trim()) return;

    setStructureConfirmed(false);
    setShowCorrectionMode(false);
    setCurrentStep('generazione_struttura');

    await runGenerationPipeline(userInput);
  };

  const handleSimulateEuristicaTrovata = () => {
    setStructureConfirmed(false);
    // Imposta il modulo trovato dall'euristica (es. medical-appointment che ha una data)
    setSelectedModuleId('medical-appointment');

    // Popola immediatamente la sidebar con la struttura dati del modulo candidato
    const candidateStructure: WizardTaskTreeNode[] = [
      {
        id: 'date',
        templateId: 'date',
        label: 'Data',
        type: 'object',
        pipelineStatus: {
          constraints: 'pending',
          parser: 'pending',
          messages: 'pending',
          constraintsProgress: 0,
          parserProgress: 0,
          messagesProgress: 0
        },
        subNodes: [
          {
            id: 'day',
            templateId: 'day',
            label: 'Giorno',
            type: 'number',
            pipelineStatus: {
              constraints: 'pending',
              parser: 'pending',
              messages: 'pending',
              constraintsProgress: 0,
              parserProgress: 0,
              messagesProgress: 0
            }
          },
          {
            id: 'month',
            templateId: 'month',
            label: 'Mese',
            type: 'number',
            pipelineStatus: {
              constraints: 'pending',
              parser: 'pending',
              messages: 'pending',
              constraintsProgress: 0,
              parserProgress: 0,
              messagesProgress: 0
            }
          },
          {
            id: 'year',
            templateId: 'year',
            label: 'Anno',
            type: 'number',
            pipelineStatus: {
              constraints: 'pending',
              parser: 'pending',
              messages: 'pending',
              constraintsProgress: 0,
              parserProgress: 0,
              messagesProgress: 0
            }
          }
        ]
      }
    ];

    // Popola i messaggi per il pannello destra
    const candidateMessages = {
      ask: {
        base: [
          'Per favore, fornisci la data di nascita.',
          'Dimmi la tua data di nascita.'
        ],
        reask: [
          'Non ho capito bene. Puoi ripetere la data di nascita?',
          'Mi serve la data di nascita completa.'
        ]
      },
      confirm: {
        base: [
          'Confermi questa data di nascita?',
          'Va bene così per la data di nascita?'
        ],
        reask: [
          'Sei sicuro di voler procedere con questa data?'
        ]
      },
      notConfirmed: {
        base: [
          'Ok, ricominciamo da capo per la data di nascita.',
          'Nessun problema, rifacciamo la data di nascita.'
        ]
      },
      violation: {
        base: [
          'C\'è un problema con la data inserita.',
          'La data di nascita non è valida.'
        ],
        reask: [
          'Correggi la data di nascita, per favore.'
        ]
      },
      disambiguation: {
        base: [
          'Intendevi una di queste date?'
        ],
        options: ['12 marzo 1990', '12 marzo 1995', '12 marzo 2000']
      },
      success: {
        base: [
          'Perfetto! Ho registrato la tua data di nascita.',
          'Tutto ok per la data di nascita!'
        ],
        reward: [
          'Ottimo lavoro!',
          'Ben fatto!'
        ]
      }
    };

    setDataSchema(candidateStructure);
    setMessages(candidateMessages);
    setCurrentStep('euristica_trovata');
  };

  const handleSimulateEuristicaNonTrovata = () => {
    setStructureConfirmed(false);
    setShowCorrectionMode(false);
    setSelectedModuleId(null);
    setDataSchema([]);
    setConstraints([]);
    setNlpContract(null);
    setMessages(null);
    resetPipeline();
    setCurrentStep('euristica_non_trovata');
  };

  const handleProceedFromEuristica = async () => {
    setStructureConfirmed(false);
    setShowCorrectionMode(false);
    setCurrentStep('generazione_struttura');
    await runGenerationPipeline(userInput);
  };

  const handleShowModuleList = () => {
    setCurrentStep('lista_moduli');
  };

  const handleSelectModule = async (moduleId: string) => {
    setStructureConfirmed(false);
    setShowCorrectionMode(false);
    setSelectedModuleId(moduleId);
    setCurrentStep('generazione_struttura');
    await runGenerationPipeline(userInput);
  };

  const handleStructureConfirm = async () => {
    setStructureConfirmed(true);
    setShowCorrectionMode(false);
    await continueAfterStructureConfirmation(dataSchema);
  };

  const handleStructureReject = () => {
    setShowCorrectionMode(true);
  };

  const calculateOverallProgress = (): number => {
    const flattenTaskTree = (nodes: WizardTaskTreeNode[]): WizardTaskTreeNode[] => {
      const result: WizardTaskTreeNode[] = [];
      nodes.forEach(node => {
        result.push(node);
        if (node.subNodes && node.subNodes.length > 0) {
          result.push(...flattenTaskTree(node.subNodes));
        }
      });
      return result;
    };

    const allTasks = flattenTaskTree(dataSchema);
    if (allTasks.length === 0) return 0;

    const phases: Array<'constraints' | 'parser' | 'messages'> = ['constraints', 'parser', 'messages'];
    const phaseProgresses = phases.map(phase => {
      const progressField = phase === 'constraints' ? 'constraintsProgress' : phase === 'parser' ? 'parserProgress' : 'messagesProgress';
      const stateField = phase === 'constraints' ? 'constraints' : phase === 'parser' ? 'parser' : 'messages';

      const progresses = allTasks.map(task => {
        const state = task.pipelineStatus?.[stateField] || 'pending';
        if (state === 'pending') return 0;
        if (state === 'completed') return 100;
        return task.pipelineStatus?.[progressField] || 0;
      });

      const total = progresses.reduce((sum, p) => sum + p, 0);
      return total / allTasks.length;
    });

    const overall = phaseProgresses.reduce((sum, p) => sum + p, 0) / phases.length;
    return Math.round(overall);
  };

  const overallProgress = calculateOverallProgress();

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <div className="flex-1 flex overflow-hidden">
        {/* ❌ RIMOSSO: Sidebar nuovo (ora usiamo quello di ResponseEditor) */}
        {/* Il Sidebar viene renderizzato da ResponseEditorNormalLayout */}

        <CenterPanel
          currentStep={currentStep}
          pipelineSteps={pipelineSteps}
          userInput={userInput}
          dataSchema={dataSchema}
          showStructureConfirmation={showStructureConfirmation}
          onStructureConfirm={handleStructureConfirm}
          onProceedFromEuristica={handleProceedFromEuristica}
          onShowModuleList={handleShowModuleList}
          onSelectModule={handleSelectModule}
          onPreviewModule={setPreviewModuleId}
          availableModules={EMPTY_MODULES}
          foundModuleId={currentStep === 'euristica_trovata' ? selectedModuleId : undefined}
          showCorrectionMode={showCorrectionMode}
          correctionInput={correctionInput}
          onCorrectionInputChange={setCorrectionInput}
        />

        <RightPanel
          messages={messages}
          isVisible={currentStep === 'modulo_pronto' || currentStep === 'euristica_trovata'}
          userInput={userInput}
          previewModuleId={previewModuleId}
          availableModules={EMPTY_MODULES}
        />
      </div>
    </div>
  );
}
