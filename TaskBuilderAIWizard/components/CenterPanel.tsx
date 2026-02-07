import { PhaseCard } from './PhaseCard';
import { PipelineStep } from '../hooks/useWizardState';
import { WizardStep, FakeTaskTreeNode, FakeModuleTemplate } from '../types';
import { Boxes, Shield, Brain, MessageSquare, Calendar, Sparkles, Utensils, Info, Truck, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { useState, useEffect } from 'react';

type CenterPanelProps = {
  currentStep: WizardStep;
  pipelineSteps: PipelineStep[];
  userInput: string;
  dataSchema: FakeTaskTreeNode[];
  showStructureConfirmation?: boolean;
  onStructureConfirm?: () => void;
  onProceedFromEuristica?: () => void;
  onShowModuleList?: () => void;
  onSelectModule?: (moduleId: string) => void;
  onPreviewModule?: (moduleId: string | null) => void;
  availableModules?: FakeModuleTemplate[];
  foundModuleId?: string;
  showCorrectionMode?: boolean;
  correctionInput?: string;
  onCorrectionInputChange?: (value: string) => void;
};

export function CenterPanel({
  currentStep,
  pipelineSteps,
  userInput,
  dataSchema,
  showStructureConfirmation,
  onStructureConfirm,
  onProceedFromEuristica,
  onShowModuleList,
  onSelectModule,
  onPreviewModule,
  availableModules = [],
  foundModuleId,
  showCorrectionMode = false,
  correctionInput = '',
  onCorrectionInputChange
}: CenterPanelProps) {
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<FakeModuleTemplate | null>(() => {
    // Se c'è un modulo trovato dall'euristica, pre-selezionalo
    if (foundModuleId && currentStep === 'euristica_trovata') {
      return availableModules.find(m => m.id === foundModuleId) || null;
    }
    return null;
  });

  // Gestione del selectedModule quando cambia lo step o foundModuleId
  useEffect(() => {
    if (currentStep === 'euristica_trovata' && foundModuleId) {
      // Se euristica ha trovato un match, pre-seleziona quel modulo
      const foundModule = availableModules.find(m => m.id === foundModuleId);
      setSelectedModule(foundModule || null);
    } else if (currentStep === 'euristica_non_trovata') {
      // Se euristica non ha trovato nulla, resetta la selezione
      setSelectedModule(null);
    } else if (currentStep !== 'euristica_trovata' && currentStep !== 'euristica_non_trovata') {
      // Per altri step, resetta la selezione
      setSelectedModule(null);
    }
  }, [currentStep, foundModuleId, availableModules]);

  const flattenTaskTree = (nodes: FakeTaskTreeNode[]): FakeTaskTreeNode[] => {
    const result: FakeTaskTreeNode[] = [];
    nodes.forEach(node => {
      result.push(node);
      if (node.subNodes && node.subNodes.length > 0) {
        result.push(...flattenTaskTree(node.subNodes));
      }
    });
    return result;
  };

  const calculatePhaseProgress = (phase: 'constraints' | 'parser' | 'messages'): number => {
    const allTasks = flattenTaskTree(dataSchema);
    if (allTasks.length === 0) return 0;

    const progressField = phase === 'constraints' ? 'constraintsProgress' : phase === 'parser' ? 'parserProgress' : 'messagesProgress';
    const stateField = phase === 'constraints' ? 'constraints' : phase === 'parser' ? 'parser' : 'messages';

    const progresses = allTasks.map(task => {
      const state = task.pipelineStatus?.[stateField] || 'pending';
      if (state === 'pending') return 0;
      if (state === 'completed') return 100;
      return task.pipelineStatus?.[progressField] || 0;
    });

    const total = progresses.reduce((sum, p) => sum + p, 0);
    return Math.round(total / allTasks.length);
  };

  const getPhaseState = (pipelineStep: PipelineStep): 'pending' | 'running' | 'completed' => {
    return pipelineStep.status === 'error' ? 'pending' : pipelineStep.status;
  };

  const phases = [
    {
      icon: Boxes,
      title: 'Struttura dati',
      payoff: 'Schema gerarchico e campi',
      step: pipelineSteps.find(s => s.id === 'structure')!,
      description: 'Definizione della struttura dati e organizzazione gerarchica dei campi necessari.'
    },
    {
      icon: Shield,
      title: 'Vincoli',
      payoff: 'Regole di validazione',
      step: pipelineSteps.find(s => s.id === 'constraints')!,
      phase: 'constraints' as const,
      description: 'Regole di validazione per garantire che i dati raccolti siano corretti e completi.'
    },
    {
      icon: Brain,
      title: 'Parser',
      payoff: 'Comprensione linguaggio naturale',
      step: pipelineSteps.find(s => s.id === 'parsers')!,
      phase: 'parser' as const,
      description: 'Interpretazione delle frasi dell\'utente attraverso NLP e pattern matching.'
    },
    {
      icon: MessageSquare,
      title: 'Messaggi',
      payoff: 'Dialogo conversazionale',
      step: pipelineSteps.find(s => s.id === 'messages')!,
      phase: 'messages' as const,
      description: 'Generazione messaggi per ogni situazione: richiesta, conferma, errore, chiarimento.'
    }
  ];

  const isGenerating = currentStep === 'generazione_struttura' ||
                       currentStep === 'generazione_constraints' ||
                       currentStep === 'generazione_contracts' ||
                       currentStep === 'generazione_messaggi' ||
                       currentStep === 'modulo_pronto';

  return (
    <main className="flex-1 px-8 py-6 bg-gray-50 overflow-y-auto">
      <div className="space-y-4 max-w-2xl">

        {/* Euristica trovata */}
        {currentStep === 'euristica_trovata' && (
          <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200">
            {/* Header con bottone in alto a destra */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-4 flex-1">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Task trovato in libreria
                  </h3>
                  <p className="text-sm text-gray-600">
                    Ho trovato un task già pronto che può raccogliere la data di nascita.
                    Puoi utilizzarlo subito o generarne uno nuovo personalizzato.
                  </p>
                </div>
              </div>

              {/* Bottone Genera nuovo task (sempre in alto a destra) */}
              <button
                onClick={onProceedFromEuristica}
                className="flex-shrink-0 bg-blue-500 text-white py-3 px-5 rounded-xl font-semibold hover:bg-blue-600 transition-colors shadow-sm"
              >
                Genera nuovo task
              </button>
            </div>

            {/* Bottone "Usa <NomeTask>" - appare solo se selectedModule != null */}
            {selectedModule && (
              <button
                onClick={() => onSelectModule?.(selectedModule.id)}
                className="w-full bg-green-500 text-white py-3 px-4 rounded-xl font-semibold hover:bg-green-600 transition-colors shadow-sm mb-3"
              >
                Usa <span className="font-bold">{selectedModule.label}</span>
              </button>
            )}

            {/* Accordion: Cerca in libreria */}
            <div className="border border-gray-300 rounded-xl overflow-hidden">
              <button
                onClick={() => setIsAccordionOpen(!isAccordionOpen)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 px-4 font-semibold transition-colors text-left flex items-center gap-2"
              >
                {isAccordionOpen ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
                <Boxes className="w-5 h-5" />
                Cerca in libreria
              </button>

              {/* Lista card (visibile solo se accordion aperto) */}
              {isAccordionOpen && (
                <div className="max-h-80 overflow-y-auto bg-gray-50 p-3 space-y-2">
                  {availableModules.map((module) => {
                    const IconComponent = module.icon === 'utensils' ? Utensils : module.icon === 'info' ? Info : Truck;
                    const isSelected = selectedModule?.id === module.id;

                    return (
                      <div
                        key={module.id}
                        onClick={() => {
                          setSelectedModule(module);
                          onPreviewModule?.(module.id);
                        }}
                        className={`bg-white rounded-lg p-4 border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-500 shadow-md'
                            : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              isSelected ? 'bg-blue-100' : 'bg-gray-100'
                            }`}>
                              <IconComponent className={`w-5 h-5 ${
                                isSelected ? 'text-blue-600' : 'text-gray-600'
                              }`} />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-semibold text-gray-900">
                                {module.label}
                              </h4>
                              {isSelected && (
                                <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                              )}
                            </div>
                            {module.examples && module.examples.length > 0 && (
                              <p className="text-xs text-gray-600 italic line-clamp-1">
                                "{module.examples[0]}"
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Euristica NON trovata */}
        {currentStep === 'euristica_non_trovata' && (
          <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200">
            {/* Header con bottone in alto a destra */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-4 flex-1">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-gray-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {selectedModule ? 'Task selezionato' : 'Nessun task selezionato'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {selectedModule
                      ? 'Hai selezionato un task dalla libreria. Puoi utilizzarlo o generarne uno nuovo personalizzato.'
                      : 'Non ho trovato task già pronti per questa richiesta. Puoi cercarne uno nella libreria o generarne uno nuovo personalizzato.'}
                  </p>
                </div>
              </div>

              {/* Bottone Genera nuovo task (sempre in alto a destra) */}
              <button
                onClick={onProceedFromEuristica}
                className="flex-shrink-0 bg-blue-500 text-white py-3 px-5 rounded-xl font-semibold hover:bg-blue-600 transition-colors shadow-sm"
              >
                Genera nuovo task
              </button>
            </div>

            {/* Bottone "Usa <NomeTask>" - appare solo se selectedModule != null */}
            {selectedModule && (
              <button
                onClick={() => onSelectModule?.(selectedModule.id)}
                className="w-full bg-green-500 text-white py-3 px-4 rounded-xl font-semibold hover:bg-green-600 transition-colors shadow-sm mb-3"
              >
                Usa <span className="font-bold">{selectedModule.label}</span>
              </button>
            )}

            {/* Accordion: Cerca in libreria */}
            <div className="border border-gray-300 rounded-xl overflow-hidden">
              <button
                onClick={() => setIsAccordionOpen(!isAccordionOpen)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 px-4 font-semibold transition-colors text-left flex items-center gap-2"
              >
                {isAccordionOpen ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
                <Boxes className="w-5 h-5" />
                Cerca in libreria
              </button>

              {/* Lista card (visibile solo se accordion aperto) */}
              {isAccordionOpen && (
                <div className="max-h-80 overflow-y-auto bg-gray-50 p-3 space-y-2">
                  {availableModules.map((module) => {
                    const IconComponent = module.icon === 'utensils' ? Utensils : module.icon === 'info' ? Info : Truck;
                    const isSelected = selectedModule?.id === module.id;

                    return (
                      <div
                        key={module.id}
                        onClick={() => {
                          setSelectedModule(module);
                          onPreviewModule?.(module.id);
                        }}
                        className={`bg-white rounded-lg p-4 border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-500 shadow-md'
                            : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              isSelected ? 'bg-blue-100' : 'bg-gray-100'
                            }`}>
                              <IconComponent className={`w-5 h-5 ${
                                isSelected ? 'text-blue-600' : 'text-gray-600'
                              }`} />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-semibold text-gray-900">
                                {module.label}
                              </h4>
                              {isSelected && (
                                <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                              )}
                            </div>
                            {module.examples && module.examples.length > 0 && (
                              <p className="text-xs text-gray-600 italic line-clamp-1">
                                "{module.examples[0]}"
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Lista moduli disponibili */}
        {currentStep === 'lista_moduli' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Task disponibili
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Seleziona un task dalla lista o genera uno nuovo personalizzato.
              </p>
            </div>

            {availableModules.map((module) => {
              const IconComponent = module.icon === 'utensils' ? Utensils : module.icon === 'info' ? Info : Truck;
              return (
                <div
                  key={module.id}
                  onClick={() => onSelectModule?.(module.id)}
                  className="bg-white rounded-2xl p-6 shadow-md border border-gray-200 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <IconComponent className="w-6 h-6 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-base font-semibold text-gray-900 mb-1">
                        {module.label}
                      </h4>
                      {module.examples && module.examples.length > 0 && (
                        <p className="text-sm text-gray-600 mb-2 italic">
                          "{module.examples[0]}"
                        </p>
                      )}
                      {module.subTasks && module.subTasks.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {module.subTasks.map((subTask, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg"
                            >
                              {subTask.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              onClick={onProceedFromEuristica}
              className="w-full bg-green-500 text-white py-3 px-4 rounded-xl font-semibold hover:bg-green-600 transition-colors shadow-sm"
            >
              Genera nuovo task personalizzato
            </button>
          </div>
        )}

        {/* Fasi di generazione */}
        {isGenerating && (
          <>
          {phases.map(({ icon, title, payoff, step, phase, description }) => {
            const isStructurePhase = step.id === 'structure';
            return (
              <PhaseCard
                key={step.id}
                icon={icon}
                title={title}
                payoff={payoff}
                state={getPhaseState(step)}
                progress={phase ? calculatePhaseProgress(phase) : undefined}
                description={description}
                isExpanded={isStructurePhase && showCorrectionMode}
                showCorrectionForm={isStructurePhase && showCorrectionMode}
                correctionInput={correctionInput}
                onCorrectionInputChange={onCorrectionInputChange}
              />
            );
          })}

          {showStructureConfirmation && !showCorrectionMode && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-blue-800 leading-relaxed">
                <strong>La struttura dati è stata generata.</strong><br />
                Conferma la struttura dati a sinistra per avviare la generazione del task.
              </p>
            </div>
          )}

          {currentStep === 'modulo_pronto' && (
            <div className="bg-green-50 border-2 border-green-500 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">✔</span>
                <h3 className="text-lg font-semibold text-green-900">
                  Task completato con successo!
                </h3>
              </div>
              <p className="text-sm text-green-700">
                Puoi visualizzare la struttura completa nella sidebar e i dialoghi di esempio nel pannello di destra.
              </p>
            </div>
          )}
        </>
        )}

      </div>
    </main>
  );
}
