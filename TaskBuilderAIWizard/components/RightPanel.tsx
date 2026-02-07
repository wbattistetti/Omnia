import { useState } from 'react';
import { FakeStepMessages, FakeModuleTemplate } from '../types';

type DialogScenario = 'happy' | 'partial' | 'error';

type RightPanelProps = {
  messages: FakeStepMessages | null;
  isVisible: boolean;
  userInput?: string;
  previewModuleId?: string | null;
  availableModules?: FakeModuleTemplate[];
};

export function RightPanel({ messages, isVisible, userInput = '', previewModuleId = null, availableModules = [] }: RightPanelProps) {
  const [activeScenario, setActiveScenario] = useState<DialogScenario>('happy');

  const previewModule = previewModuleId ? availableModules.find(m => m.id === previewModuleId) : null;

  const getModuleDialogs = (module: FakeModuleTemplate, scenario: DialogScenario) => {
    switch (module.id) {
      case 'booking-restaurant':
        return scenario === 'happy' ? [
          { role: 'bot' as const, text: 'Per favore, dimmi per quante persone vuoi prenotare e quando.' },
          { role: 'user' as const, text: 'Vorrei prenotare per 4 persone domani sera alle 20:00' },
          { role: 'bot' as const, text: 'Perfetto! Confermi la prenotazione per 4 persone domani sera alle 20:00?' },
          { role: 'user' as const, text: 'Sì, confermo' },
          { role: 'bot' as const, text: 'Prenotazione confermata! A domani sera!' }
        ] : scenario === 'partial' ? [
          { role: 'bot' as const, text: 'Per favore, dimmi per quante persone vuoi prenotare e quando.' },
          { role: 'user' as const, text: 'Per 4 persone' },
          { role: 'bot' as const, text: 'Per quale giorno e che orario?' },
          { role: 'user' as const, text: 'Domani sera alle 20' },
          { role: 'bot' as const, text: 'Perfetto! Prenotazione completata.' }
        ] : [
          { role: 'bot' as const, text: 'Per favore, dimmi per quante persone vuoi prenotare.' },
          { role: 'user' as const, text: 'Per 50 persone' },
          { role: 'bot' as const, text: 'Mi dispiace, possiamo accogliere fino a 20 persone. Prova con un numero inferiore.' },
          { role: 'user' as const, text: 'Va bene, per 15 persone' },
          { role: 'bot' as const, text: 'Perfetto! Procediamo con 15 persone.' }
        ];

      case 'haircut-appointment':
        return scenario === 'happy' ? [
          { role: 'bot' as const, text: 'Quando vorresti venire per il taglio?' },
          { role: 'user' as const, text: 'Giovedì prossimo alle 15' },
          { role: 'bot' as const, text: 'Che tipo di servizio desideri?' },
          { role: 'user' as const, text: 'Solo taglio' },
          { role: 'bot' as const, text: 'Perfetto! Appuntamento fissato per giovedì alle 15.' }
        ] : scenario === 'partial' ? [
          { role: 'bot' as const, text: 'Quando vorresti venire?' },
          { role: 'user' as const, text: 'Giovedì' },
          { role: 'bot' as const, text: 'A che ora preferisci?' },
          { role: 'user' as const, text: 'Nel pomeriggio' },
          { role: 'bot' as const, text: 'Abbiamo disponibilità alle 15 o alle 17. Quale preferisci?' },
          { role: 'user' as const, text: 'Alle 15 va bene' }
        ] : [
          { role: 'bot' as const, text: 'Quando vorresti venire?' },
          { role: 'user' as const, text: 'Ieri' },
          { role: 'bot' as const, text: 'Non posso prenotare una data passata. Scegli una data futura.' },
          { role: 'user' as const, text: 'Ok, domani alle 10' },
          { role: 'bot' as const, text: 'Perfetto! A domani!' }
        ];

      case 'order-delivery':
        return scenario === 'happy' ? [
          { role: 'bot' as const, text: 'Cosa vorresti ordinare?' },
          { role: 'user' as const, text: 'Una pizza margherita e una coca cola' },
          { role: 'bot' as const, text: 'Qual è il tuo indirizzo di consegna?' },
          { role: 'user' as const, text: 'Via Roma 15, Milano' },
          { role: 'bot' as const, text: 'Ordine confermato! Consegna in 30 minuti.' }
        ] : scenario === 'partial' ? [
          { role: 'bot' as const, text: 'Cosa vorresti ordinare?' },
          { role: 'user' as const, text: 'Una pizza' },
          { role: 'bot' as const, text: 'Che tipo di pizza?' },
          { role: 'user' as const, text: 'Margherita' },
          { role: 'bot' as const, text: 'Qual è il tuo indirizzo?' },
          { role: 'user' as const, text: 'Via Roma 15' }
        ] : [
          { role: 'bot' as const, text: 'Qual è il tuo indirizzo di consegna?' },
          { role: 'user' as const, text: 'Via Roma' },
          { role: 'bot' as const, text: 'Mi serve anche il numero civico per la consegna.' },
          { role: 'user' as const, text: 'Numero 15' },
          { role: 'bot' as const, text: 'Perfetto! Ordine in arrivo.' }
        ];

      default:
        return scenario === 'happy' ? [
          { role: 'bot' as const, text: 'Ciao! Come posso aiutarti?' },
          { role: 'user' as const, text: module.examples?.[0] || 'Vorrei usare questo servizio' },
          { role: 'bot' as const, text: 'Perfetto! Procediamo.' },
          { role: 'user' as const, text: 'Va bene' },
          { role: 'bot' as const, text: 'Tutto fatto!' }
        ] : scenario === 'partial' ? [
          { role: 'bot' as const, text: 'Ciao! Come posso aiutarti?' },
          { role: 'user' as const, text: 'Vorrei...' },
          { role: 'bot' as const, text: 'Di cosa hai bisogno?' },
          { role: 'user' as const, text: module.examples?.[0] || 'Questo servizio' },
          { role: 'bot' as const, text: 'Capito! Procedo.' }
        ] : [
          { role: 'bot' as const, text: 'Ciao! Come posso aiutarti?' },
          { role: 'user' as const, text: 'Non so' },
          { role: 'bot' as const, text: 'Puoi dirmi cosa ti serve?' },
          { role: 'user' as const, text: module.examples?.[0] || 'Ok, questo' },
          { role: 'bot' as const, text: 'Perfetto!' }
        ];
    }
  };

  const getContextualDialogs = (scenario: DialogScenario) => {
    const lowercased = userInput.toLowerCase();
    const isBirthdate = lowercased.includes('data di nascita') || lowercased.includes('data nascita') || lowercased.includes('nascita');

    if (isBirthdate) {
      switch (scenario) {
        case 'happy':
          return [
            { role: 'bot' as const, text: messages?.ask.base[0] || 'Per favore, fornisci la tua data di nascita.' },
            { role: 'user' as const, text: 'Sono nato il 15 marzo 1990' },
            { role: 'bot' as const, text: messages?.confirm?.base[0] || 'Confermi la data 15/03/1990?' },
            { role: 'user' as const, text: 'Sì, confermo' },
            { role: 'bot' as const, text: messages?.success?.base[0] || 'Perfetto! Data di nascita registrata.' }
          ];
        case 'partial':
          return [
            { role: 'bot' as const, text: messages?.ask.base[0] || 'Per favore, fornisci la tua data di nascita.' },
            { role: 'user' as const, text: 'Sono nato a marzo del 1990' },
            { role: 'bot' as const, text: 'Mi manca il giorno. Che giorno di marzo?' },
            { role: 'user' as const, text: 'Il 15' },
            { role: 'bot' as const, text: messages?.success?.base[0] || 'Perfetto! Data completa registrata.' }
          ];
        case 'error':
          return [
            { role: 'bot' as const, text: messages?.ask.base[0] || 'Per favore, fornisci la tua data di nascita.' },
            { role: 'user' as const, text: '32 gennaio 2025' },
            { role: 'bot' as const, text: messages?.violation?.base[0] || 'La data non è valida. Il 32 gennaio non esiste.' },
            { role: 'user' as const, text: '12 gennaio 1990' },
            { role: 'bot' as const, text: messages?.success?.base[0] || 'Perfetto! Data valida.' }
          ];
      }
    }

    return [];
  };

  if (!isVisible && !previewModule) {
    return null;
  }

  const activeDialogs = previewModule ? getModuleDialogs(previewModule, activeScenario) : getContextualDialogs(activeScenario);

  const scenarios: { id: DialogScenario; label: string }[] = [
    { id: 'happy', label: 'Happy Path' },
    { id: 'error', label: 'Errori' },
    { id: 'partial', label: 'Frasi parziali' }
  ];

  const renderDialog = () => {
    if (!messages && !previewModule) {
      return (
        <div className="text-center text-gray-500 py-8 text-sm">
          Nessun messaggio generato
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {activeDialogs.map((dialog, index) => (
          <div key={index} className={`flex ${dialog.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`
                max-w-xs px-4 py-3 rounded-2xl text-sm shadow-sm
                ${dialog.role === 'bot'
                  ? 'bg-blue-50 text-gray-900 rounded-bl-sm'
                  : 'bg-gray-800 text-white rounded-br-sm'
                }
              `}
            >
              {dialog.text}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <aside className="w-80 border-l bg-white px-4 py-4 flex flex-col overflow-y-auto">
      <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
        Anteprima Dialoghi
      </div>

      <div className="flex gap-2 mb-3 text-xs">
        {scenarios.map(scenario => (
          <button
            key={scenario.id}
            onClick={() => setActiveScenario(scenario.id)}
            className={`px-3 py-1 rounded-full transition-colors ${
              activeScenario === scenario.id
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {scenario.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2 overflow-auto bg-gray-50 rounded-2xl p-3">
        {renderDialog()}
      </div>
    </aside>
  );
}
