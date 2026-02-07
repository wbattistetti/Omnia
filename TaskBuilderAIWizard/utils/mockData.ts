import { FakeDataNode, FakeConstraint, FakeNLPContract, FakeStepMessages, FakeModuleTemplate, FakeTaskTreeNode } from '../types';

export const MOCK_MODULES: FakeModuleTemplate[] = [
  {
    id: 'booking-restaurant',
    name: 'booking_restaurant',
    label: 'Prenota Ristorante',
    type: 'composite',
    icon: 'utensils',
    examples: ['Voglio prenotare un tavolo per 4 persone domani sera alle 20:00'],
    subTasks: [
      { templateId: 'date', label: 'Data Prenotazione', type: 'date' },
      { templateId: 'time', label: 'Orario', type: 'time' },
      { templateId: 'guests', label: 'Numero Ospiti', type: 'number' }
    ]
  },
  {
    id: 'request-info',
    name: 'request_info',
    label: 'Richiesta Informazioni',
    type: 'simple',
    icon: 'info',
    examples: ['Quali sono gli orari di apertura?', 'Avete posti per disabili?']
  },
  {
    id: 'order-delivery',
    name: 'order_delivery',
    label: 'Ordine Consegna',
    type: 'composite',
    icon: 'truck',
    examples: ['Vorrei ordinare una pizza margherita a domicilio'],
    subTasks: [
      { templateId: 'items', label: 'Prodotti', type: 'list' },
      { templateId: 'address', label: 'Indirizzo', type: 'address' },
      { templateId: 'payment', label: 'Metodo Pagamento', type: 'enum' }
    ]
  },
  {
    id: 'medical-appointment',
    name: 'medical_appointment',
    label: 'Appuntamento Medico',
    type: 'composite',
    icon: 'info',
    examples: ['Vorrei fissare una visita dal dottore'],
    subTasks: [
      { templateId: 'date', label: 'Data', type: 'date' },
      { templateId: 'doctor', label: 'Medico', type: 'string' }
    ]
  },
  {
    id: 'hotel-booking',
    name: 'hotel_booking',
    label: 'Prenota Hotel',
    type: 'composite',
    icon: 'info',
    examples: ['Voglio prenotare una camera per il weekend'],
    subTasks: [
      { templateId: 'checkin', label: 'Check-in', type: 'date' },
      { templateId: 'checkout', label: 'Check-out', type: 'date' }
    ]
  },
  {
    id: 'flight-booking',
    name: 'flight_booking',
    label: 'Prenota Volo',
    type: 'composite',
    icon: 'truck',
    examples: ['Cerco un volo per Roma'],
    subTasks: [
      { templateId: 'departure', label: 'Partenza', type: 'string' },
      { templateId: 'arrival', label: 'Arrivo', type: 'string' }
    ]
  },
  {
    id: 'gym-subscription',
    name: 'gym_subscription',
    label: 'Iscrizione Palestra',
    type: 'composite',
    icon: 'info',
    examples: ['Vorrei iscrivermi in palestra'],
    subTasks: [
      { templateId: 'plan', label: 'Piano', type: 'enum' },
      { templateId: 'start_date', label: 'Inizio', type: 'date' }
    ]
  },
  {
    id: 'car-rental',
    name: 'car_rental',
    label: 'Noleggio Auto',
    type: 'composite',
    icon: 'truck',
    examples: ['Devo noleggiare una macchina'],
    subTasks: [
      { templateId: 'pickup', label: 'Ritiro', type: 'date' },
      { templateId: 'return', label: 'Riconsegna', type: 'date' }
    ]
  },
  {
    id: 'event-ticket',
    name: 'event_ticket',
    label: 'Biglietto Evento',
    type: 'composite',
    icon: 'info',
    examples: ['Voglio comprare biglietti per il concerto'],
    subTasks: [
      { templateId: 'event', label: 'Evento', type: 'string' },
      { templateId: 'quantity', label: 'Quantità', type: 'number' }
    ]
  },
  {
    id: 'haircut-appointment',
    name: 'haircut_appointment',
    label: 'Appuntamento Parrucchiere',
    type: 'composite',
    icon: 'utensils',
    examples: ['Devo tagliarmi i capelli'],
    subTasks: [
      { templateId: 'date', label: 'Data', type: 'date' },
      { templateId: 'service', label: 'Servizio', type: 'string' }
    ]
  },
  {
    id: 'spa-reservation',
    name: 'spa_reservation',
    label: 'Prenotazione SPA',
    type: 'composite',
    icon: 'info',
    examples: ['Vorrei prenotare un massaggio'],
    subTasks: [
      { templateId: 'date', label: 'Data', type: 'date' },
      { templateId: 'treatment', label: 'Trattamento', type: 'string' }
    ]
  },
  {
    id: 'vet-appointment',
    name: 'vet_appointment',
    label: 'Appuntamento Veterinario',
    type: 'composite',
    icon: 'info',
    examples: ['Il mio cane ha bisogno del veterinario'],
    subTasks: [
      { templateId: 'date', label: 'Data', type: 'date' },
      { templateId: 'pet_name', label: 'Nome Animale', type: 'string' }
    ]
  },
  {
    id: 'tutoring-session',
    name: 'tutoring_session',
    label: 'Lezione Privata',
    type: 'composite',
    icon: 'info',
    examples: ['Cerco ripetizioni di matematica'],
    subTasks: [
      { templateId: 'subject', label: 'Materia', type: 'string' },
      { templateId: 'date', label: 'Data', type: 'date' }
    ]
  },
  {
    id: 'taxi-booking',
    name: 'taxi_booking',
    label: 'Prenota Taxi',
    type: 'composite',
    icon: 'truck',
    examples: ['Mi serve un taxi per l\'aeroporto'],
    subTasks: [
      { templateId: 'pickup', label: 'Luogo ritiro', type: 'string' },
      { templateId: 'destination', label: 'Destinazione', type: 'string' }
    ]
  },
  {
    id: 'dentist-appointment',
    name: 'dentist_appointment',
    label: 'Appuntamento Dentista',
    type: 'composite',
    icon: 'info',
    examples: ['Devo andare dal dentista'],
    subTasks: [
      { templateId: 'date', label: 'Data', type: 'date' },
      { templateId: 'reason', label: 'Motivo', type: 'string' }
    ]
  },
  {
    id: 'museum-ticket',
    name: 'museum_ticket',
    label: 'Biglietto Museo',
    type: 'simple',
    icon: 'info',
    examples: ['Vorrei visitare il museo']
  },
  {
    id: 'library-card',
    name: 'library_card',
    label: 'Tessera Biblioteca',
    type: 'simple',
    icon: 'info',
    examples: ['Come posso iscrivermi in biblioteca?']
  },
  {
    id: 'insurance-quote',
    name: 'insurance_quote',
    label: 'Preventivo Assicurazione',
    type: 'composite',
    icon: 'info',
    examples: ['Vorrei un preventivo per l\'assicurazione auto'],
    subTasks: [
      { templateId: 'type', label: 'Tipo', type: 'enum' },
      { templateId: 'coverage', label: 'Copertura', type: 'string' }
    ]
  },
  {
    id: 'maintenance-request',
    name: 'maintenance_request',
    label: 'Richiesta Manutenzione',
    type: 'composite',
    icon: 'truck',
    examples: ['C\'è un problema con il riscaldamento'],
    subTasks: [
      { templateId: 'issue', label: 'Problema', type: 'string' },
      { templateId: 'urgency', label: 'Urgenza', type: 'enum' }
    ]
  },
  {
    id: 'parking-permit',
    name: 'parking_permit',
    label: 'Permesso Parcheggio',
    type: 'composite',
    icon: 'truck',
    examples: ['Come ottengo il permesso di parcheggio?'],
    subTasks: [
      { templateId: 'zone', label: 'Zona', type: 'string' },
      { templateId: 'duration', label: 'Durata', type: 'string' }
    ]
  }
];

/**
 * Converte un FakeDataNode in un FakeTaskTreeNode con pipelineStatus inizializzati
 */
function convertToTaskTreeNode(dataNode: FakeDataNode): FakeTaskTreeNode {
  return {
    id: dataNode.id,
    templateId: dataNode.id,
    label: dataNode.label,
    type: dataNode.type,
    pipelineStatus: {
      constraints: 'pending',
      parser: 'pending',
      messages: 'pending',
      constraintsProgress: 0,
      parserProgress: 0,
      messagesProgress: 0
    },
    subNodes: dataNode.children?.map(convertToTaskTreeNode)
  };
}

export function generateMockDataNodes(userInput: string): FakeTaskTreeNode[] {
  const lowercased = userInput.toLowerCase();

  let dataNodes: FakeDataNode[] = [];

  if (lowercased.includes('prenotare') || lowercased.includes('tavolo') || lowercased.includes('ristorante')) {
    dataNodes = [
      {
        id: 'booking',
        label: 'Prenotazione Ristorante',
        type: 'object',
        children: [
          { id: 'date', label: 'Data', type: 'date' },
          { id: 'time', label: 'Orario', type: 'string' },
          { id: 'guests', label: 'Numero Ospiti', type: 'number' },
          { id: 'name', label: 'Nome Cliente', type: 'string' },
          { id: 'phone', label: 'Telefono', type: 'string' }
        ]
      }
    ];
  } else if (lowercased.includes('ordine') || lowercased.includes('pizza') || lowercased.includes('consegna')) {
    dataNodes = [
      {
        id: 'order',
        label: 'Ordine',
        type: 'object',
        children: [
          {
            id: 'items',
            label: 'Prodotti',
            type: 'object',
            children: [
              { id: 'name', label: 'Nome Prodotto', type: 'string' },
              { id: 'quantity', label: 'Quantità', type: 'number' }
            ]
          },
          { id: 'address', label: 'Indirizzo Consegna', type: 'string' },
          { id: 'payment', label: 'Metodo Pagamento', type: 'string' }
        ]
      }
    ];
  } else if (lowercased.includes('data di nascita') || lowercased.includes('data nascita') || (lowercased.includes('nascita') && lowercased.includes('paziente'))) {
    dataNodes = [
      {
        id: 'birthdate',
        label: 'Data di Nascita',
        type: 'object',
        children: [
          { id: 'day', label: 'Giorno', type: 'number' },
          { id: 'month', label: 'Mese', type: 'number' },
          { id: 'year', label: 'Anno', type: 'number' }
        ]
      }
    ];
  } else if (lowercased.includes('indirizzo') || lowercased.includes('residenza')) {
    dataNodes = [
      {
        id: 'address',
        label: 'Indirizzo',
        type: 'object',
        children: [
          { id: 'street', label: 'Via', type: 'string' },
          { id: 'number', label: 'Numero Civico', type: 'string' },
          { id: 'city', label: 'Città', type: 'string' },
          { id: 'postal_code', label: 'CAP', type: 'string' },
          { id: 'country', label: 'Paese', type: 'string' }
        ]
      }
    ];
  } else if (lowercased.includes('appuntamento') || lowercased.includes('visita medica')) {
    dataNodes = [
      {
        id: 'appointment',
        label: 'Appuntamento',
        type: 'object',
        children: [
          {
            id: 'date',
            label: 'Data',
            type: 'object',
            children: [
              { id: 'day', label: 'Giorno', type: 'number' },
              { id: 'month', label: 'Mese', type: 'number' },
              { id: 'year', label: 'Anno', type: 'number' }
            ]
          },
          { id: 'time', label: 'Orario', type: 'string' },
          { id: 'doctor', label: 'Medico', type: 'string' },
          { id: 'reason', label: 'Motivo', type: 'string' }
        ]
      }
    ];
  } else {
    dataNodes = [
      {
        id: 'patient_info',
        label: 'Informazioni Paziente',
        type: 'object',
        children: [
          { id: 'name', label: 'Nome', type: 'string' },
          { id: 'surname', label: 'Cognome', type: 'string' },
          {
            id: 'birthdate',
            label: 'Data di Nascita',
            type: 'object',
            children: [
              { id: 'day', label: 'Giorno', type: 'number' },
              { id: 'month', label: 'Mese', type: 'number' },
              { id: 'year', label: 'Anno', type: 'number' }
            ]
          }
        ]
      }
    ];
  }

  // Converto i FakeDataNode in FakeTaskTreeNode con pipelineStatus inizializzati
  return dataNodes.map(convertToTaskTreeNode);
}

export function generateMockConstraints(schema: FakeDataNode[]): FakeConstraint[] {
  const constraints: FakeConstraint[] = [];

  schema.forEach(node => {
    node.children?.forEach(child => {
      if (child.type === 'date') {
        constraints.push({
          kind: 'min_date',
          title: 'Data Futura',
          payoff: 'La data deve essere futura',
          min: 'today'
        });
      }
      if (child.type === 'number' && child.label.includes('Ospiti')) {
        constraints.push({
          kind: 'range',
          title: 'Numero Valido',
          payoff: 'Il numero di ospiti deve essere tra 1 e 20',
          min: 1,
          max: 20
        });
      }
      if (child.type === 'string' && child.label.includes('Telefono')) {
        constraints.push({
          kind: 'pattern',
          title: 'Formato Telefono',
          payoff: 'Il telefono deve essere in formato italiano',
          pattern: '^\\+?39?[\\s]?[0-9]{9,10}$'
        });
      }
      if (child.label.includes('Pagamento')) {
        constraints.push({
          kind: 'enum',
          title: 'Metodo Valido',
          payoff: 'Il metodo di pagamento deve essere tra quelli disponibili',
          values: ['Contanti', 'Carta', 'PayPal']
        });
      }
    });
  });

  return constraints;
}

export function generateMockContract(schema: FakeDataNode[]): FakeNLPContract {
  const firstNode = schema[0];
  const templateName = firstNode?.label || 'Modulo Generico';

  return {
    templateName,
    templateId: firstNode?.id || 'generic',
    subDataMapping: Object.fromEntries(
      (firstNode?.children || []).map(child => [
        child.id,
        {
          canonicalKey: child.id,
          label: child.label,
          type: child.type
        }
      ])
    ),
    regex: {
      patterns: [
        '\\b(prenot[ao]|tavolo|ristorante)\\b',
        '\\b(\\d{1,2})\\s*(persone?|ospiti?)\\b',
        '\\b(domani|oggi|dopodomani)\\b'
      ],
      testCases: [
        'Voglio prenotare un tavolo',
        'Per 4 persone',
        'Domani sera'
      ]
    },
    rules: {
      extractorCode: 'function extract(text) { /* ... */ }',
      validators: [],
      testCases: ['Test case 1', 'Test case 2']
    },
    ner: {
      entityTypes: ['DATE', 'NUMBER', 'PERSON'],
      confidence: 0.85,
      enabled: true
    },
    llm: {
      systemPrompt: `Sei un assistente che estrae informazioni per ${templateName.toLowerCase()}.`,
      userPromptTemplate: 'Estrai i seguenti campi dal testo: {{fields}}',
      responseSchema: {
        type: 'object',
        properties: Object.fromEntries(
          (firstNode?.children || []).map(child => [
            child.id,
            { type: child.type === 'number' ? 'integer' : 'string' }
          ])
        )
      },
      enabled: true
    }
  };
}

export function generateMockMessages(schema: FakeDataNode[]): FakeStepMessages {
  const firstNode = schema[0];
  const label = firstNode?.label?.toLowerCase() || 'informazione';

  return {
    ask: {
      base: [
        `Per favore, fornisci i dettagli per ${label}.`,
        `Dimmi le informazioni necessarie per ${label}.`
      ],
      reask: [
        `Non ho capito bene. Puoi ripetere i dettagli per ${label}?`,
        `Mi serve qualche informazione in più per ${label}.`
      ]
    },
    confirm: {
      base: [
        `Confermi questi dati per ${label}?`,
        `Va bene così per ${label}?`
      ],
      reask: [
        `Sei sicuro di voler procedere con questi dati per ${label}?`
      ]
    },
    notConfirmed: {
      base: [
        `Ok, ricominciamo da capo per ${label}.`,
        `Nessun problema, rifacciamo ${label}.`
      ]
    },
    violation: {
      base: [
        `C'è un problema con i dati inseriti per ${label}.`,
        `I dati per ${label} non sono validi.`
      ],
      reask: [
        `Correggi i dati per ${label}, per favore.`
      ]
    },
    disambiguation: {
      base: [
        `Intendevi una di queste opzioni per ${label}?`
      ],
      options: ['Opzione A', 'Opzione B', 'Opzione C']
    },
    success: {
      base: [
        `Perfetto! Ho registrato ${label}.`,
        `Tutto ok per ${label}!`
      ],
      reward: [
        `Ottimo lavoro!`,
        `Ben fatto!`
      ]
    }
  };
}
