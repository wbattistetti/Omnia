import { PhaseCardContainer } from './PhaseCardContainer';
import type { PipelineStep } from '../store/wizardStore';
import { WizardStep, WizardTaskTreeNode, WizardModuleTemplate } from '../types';
import { Boxes, Shield, Brain, MessageSquare, Calendar, Sparkles, Utensils, Info, Truck, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';

type CenterPanelProps = {
  currentStep: WizardStep | 'idle'; // DEPRECATED: mantenuto per compatibilità
  pipelineSteps: PipelineStep[];
  userInput: string; // DEPRECATED: non più usato, mantenuto per compatibilità
  dataSchema: WizardTaskTreeNode[];
  showStructureConfirmation?: boolean;
  onStructureConfirm?: () => void;
  onProceedFromEuristica?: () => void;
  onShowModuleList?: () => void;
  onSelectModule?: (moduleId: string) => void;
  onPreviewModule?: (moduleId: string | null) => void;
  availableModules?: WizardModuleTemplate[];
  foundModuleId?: string;
  showCorrectionMode?: boolean;
  correctionInput?: string;
  onCorrectionInputChange?: (value: string) => void;
  // ✅ NEW: Sotto-stati per parte variabile dinamica
  currentParserSubstep?: string | null;
  currentMessageSubstep?: string | null;
  // ✅ NEW: Phase counters (source of truth for progress)
  phaseCounters?: {
    constraints: { completed: number; total: number };
    parsers: { completed: number; total: number };
    messages: { completed: number; total: number };
  };
};

export function CenterPanel({
  currentStep,
  pipelineSteps,
  userInput, // DEPRECATED: non più usato
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
  onCorrectionInputChange,
  currentParserSubstep = null,
  currentMessageSubstep = null,
  phaseCounters // ✅ DEPRECATED: Phase counters now read directly from store via PhaseCardContainer
}: CenterPanelProps) {
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<WizardModuleTemplate | null>(() => {
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

  // ✅ OPTIMIZATION: Extract helper functions outside useMemo to prevent recreation
  // These are stable and don't depend on render-time values
  const getStructureStep = useCallback(() => {
    return pipelineSteps.find(s => s.id === 'structure');
  }, [pipelineSteps]);

  // ✅ OPTIMIZATION: Memoize phases array - only recreate when pipelineSteps or showStructureConfirmation change
  const phases = useMemo(() => {
    const structureStep = getStructureStep();
    const constraintsStep = pipelineSteps.find(s => s.id === 'constraints');
    const parsersStep = pipelineSteps.find(s => s.id === 'parsers');
    const messagesStep = pipelineSteps.find(s => s.id === 'messages');

    // Early return if steps are not ready
    if (!structureStep || !constraintsStep || !parsersStep || !messagesStep) {
      return [];
    }

    return [
      {
        stepId: 'structure' as const,
        icon: Boxes,
        title: 'Struttura dati',
      },
      {
        stepId: 'constraints' as const,
        icon: Shield,
        title: 'Regole di validazione',
      },
      {
        stepId: 'parsers' as const,
        icon: Brain,
        title: 'Parser',
      },
      {
        stepId: 'messages' as const,
        icon: MessageSquare,
        title: 'Messaggi',
      }
    ];
  }, [pipelineSteps, getStructureStep]);

  const isGenerating = currentStep === 'generazione_struttura' ||
                       currentStep === 'generazione_constraints' ||
                       currentStep === 'generazione_contracts' ||
                       currentStep === 'generazione_messaggi' ||
                       currentStep === 'modulo_pronto';

  // ✅ FIX: Show cards immediately when wizard is active, even during START/idle
  // Cards will be shown in placeholder/gray state until generation starts
  const shouldShowCards = isGenerating ||
                          currentStep === 'idle' ||
                          currentStep === 'start' ||
                          pipelineSteps.length > 0;

  return (
    <main className="flex-1 px-8 py-6 bg-gray-50 overflow-y-auto">
      <div className="space-y-4 w-full">

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
        {shouldShowCards && (
          <>
          {phases.map(({ stepId, icon, title }) => (
            <PhaseCardContainer
              key={stepId}
              stepId={stepId}
              icon={icon}
              title={title}
              showCorrectionMode={showCorrectionMode}
              correctionInput={correctionInput}
              onCorrectionInputChange={onCorrectionInputChange}
            />
          ))}

          {showStructureConfirmation && !showCorrectionMode && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-blue-800 leading-relaxed">
                <strong>La struttura dati è stata generata.</strong><br />
                Conferma la struttura dati a sinistra per avviare la generazione del task.
              </p>
            </div>
          )}

          {/* ✅ RIMOSSO: Pannello verde finale - il wizard si chiude automaticamente quando tutti gli step sono completati */}
        </>
        )}

        {/* ✅ RIMOSSO: Step idle non più necessario - il wizard parte automaticamente con taskLabel */}

        {/* ✅ FALLBACK: Se nessuna condizione è vera, mostra un messaggio */}
        {currentStep !== 'idle' &&
         currentStep !== 'euristica_trovata' &&
         currentStep !== 'euristica_non_trovata' &&
         currentStep !== 'lista_moduli' &&
         !isGenerating && (
          <div className="bg-yellow-50 border-2 border-yellow-500 rounded-2xl p-6 shadow-md">
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">
              Wizard in attesa
            </h3>
            <p className="text-sm text-yellow-700 mb-4">
              Stato corrente: <code className="bg-yellow-100 px-2 py-1 rounded">{currentStep}</code>
            </p>
            <p className="text-sm text-yellow-600">
              Il wizard è attivo ma non ci sono contenuti da mostrare per questo step.
              {pipelineSteps.length === 0 && ' La pipeline non è ancora stata inizializzata.'}
              {dataSchema.length === 0 && ' Non ci sono dati nello schema.'}
            </p>
          </div>
        )}

      </div>
    </main>
  );
}
