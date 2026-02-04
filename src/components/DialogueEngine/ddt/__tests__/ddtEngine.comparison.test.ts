// Test comparativi: Vecchio Engine vs Nuovo Engine
// Garantisce che il nuovo engine produca gli stessi risultati del vecchio

import { runDDT } from '../ddtEngine';
import { executeGetDataHierarchical } from '../ddtNavigator';
import type { AssembledTaskTree, dataNode } from '../../../TaskTreeBuilder/DDTAssembler/currentDDT.types';
import type { DDTState, DDTNavigatorCallbacks } from '../ddtTypes';

// ============================================================================
// HELPER: Crea DDT di test minimale
// ============================================================================

function createTestDDT(overrides?: Partial<AssembledTaskTree>): AssembledTaskTree {
  const data: dataNode = {
    id: 'test-main',
    label: 'Test Data',
    required: true,
    steps: [
      {
        type: 'start',
        escalations: [
          {
            level: 1,
            actions: [
              {
                actionId: 'sayMessage',
                actionInstanceId: 'msg-1',
                parameters: [
                  {
                    parameterId: 'text',
                    value: 'Please provide test data'
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        type: 'noMatch',
        escalations: [
          {
            level: 1,
            actions: [
              {
                actionId: 'sayMessage',
                actionInstanceId: 'msg-2',
                parameters: [
                  {
                    parameterId: 'text',
                    value: 'I did not understand. Please try again.'
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        type: 'noInput',
        escalations: [
          {
            level: 1,
            actions: [
              {
                actionId: 'sayMessage',
                actionInstanceId: 'msg-4',
                parameters: [
                  {
                    parameterId: 'text',
                    value: 'I did not receive any input. Please try again.'
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        type: 'success',
        escalations: [
          {
            level: 1,
            actions: [
              {
                actionId: 'sayMessage',
                actionInstanceId: 'msg-3',
                parameters: [
                  {
                    parameterId: 'text',
                    value: 'Thank you!'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  return {
    id: 'test-ddt',
    label: 'Test DDT',
    data,
    translations: {},
    ...overrides
  };
}

// ============================================================================
// HELPER: Crea callbacks mock
// ============================================================================

function createMockCallbacks(): {
  callbacks: DDTNavigatorCallbacks;
  messages: Array<{ text: string; stepType?: string; escalationLevel?: number }>;
  events: Array<{ type: string; value?: any }>;
} {
  const messages: Array<{ text: string; stepType?: string; escalationLevel?: number }> = [];
  const events: Array<{ type: string; value?: any }> = [];
  let eventIndex = 0;

  const callbacks: DDTNavigatorCallbacks = {
    onMessage: (text: string, stepType?: string, escalationLevel?: number) => {
      messages.push({ text, stepType, escalationLevel });
      console.log('[TEST] Message received:', { text, stepType, escalationLevel });
    },
    onGetRetrieveEvent: async (nodeId: string) => {
      const event = events[eventIndex++];
      if (!event) {
        throw new Error('No more events available');
      }
      console.log('[TEST] Event requested:', { nodeId, event });
      return event as any;
    },
    onProcessInput: async (input: string, node: any) => {
      // Mock: accetta qualsiasi input non vuoto come match
      if (input.trim().length === 0) {
        return { status: 'noInput' };
      }
      if (input.toLowerCase() === 'nomatch') {
        return { status: 'noMatch' };
      }
      return { status: 'match', value: input };
    },
    translations: {}
  };

  return { callbacks, messages, events };
}

// ============================================================================
// TEST: Confronto base - Start → Match → Success
// ============================================================================

describe('DDT Engine Comparison Tests', () => {
  test('Simple flow: Start → Match → Success (NEW ENGINE)', async () => {
    const ddt = createTestDDT();
    const { callbacks, messages, events } = createMockCallbacks();

    // Simula input utente
    events.push({ type: 'match', value: 'test@example.com' });

    const result = await runDDT(ddt, callbacks);

    // Verifica risultati
    expect(result.success).toBe(true);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].stepType).toBe('start');
    expect(messages[messages.length - 1].stepType).toBe('success');
  });

  test('Simple flow: Start → Match → Success (OLD ENGINE)', async () => {
    const ddt = createTestDDT();
    const { callbacks, messages, events } = createMockCallbacks();
    const state: DDTState = {
      memory: {},
      noMatchCounters: {},
      noInputCounters: {},
      notConfirmedCounters: {}
    };

    // Simula input utente
    events.push({ type: 'match', value: 'test@example.com' });

    const result = await executeGetDataHierarchical(ddt, state, callbacks);

    // Verifica risultati
    expect(result.success).toBe(true);
    expect(messages.length).toBeGreaterThan(0);
  });

  test('NoMatch escalation flow (NEW ENGINE)', async () => {
    const ddt = createTestDDT();
    const { callbacks, messages, events } = createMockCallbacks();

    // Simula: noMatch → match
    events.push({ type: 'noMatch' });
    events.push({ type: 'match', value: 'test@example.com' });

    const result = await runDDT(ddt, callbacks);

    expect(result.success).toBe(true);
    // Dovrebbe mostrare escalation noMatch
    const noMatchMessage = messages.find(m => m.stepType === 'noMatch');
    expect(noMatchMessage).toBeDefined();
  });

  test('NoInput escalation flow (NEW ENGINE)', async () => {
    const ddt = createTestDDT();
    const { callbacks, messages, events } = createMockCallbacks();

    // Simula: noInput → match
    events.push({ type: 'noInput' });
    events.push({ type: 'match', value: 'test@example.com' });

    const result = await runDDT(ddt, callbacks);

    expect(result.success).toBe(true);
    // Dovrebbe mostrare escalation noInput
    const noInputMessage = messages.find(m => m.stepType === 'noInput');
    expect(noInputMessage).toBeDefined();
  });
});

// ============================================================================
// TEST: Confronto diretto vecchio vs nuovo (stesso input)
// ============================================================================

describe('Direct Comparison: Old vs New Engine', () => {
  test('Same DDT, same input → should produce similar results', async () => {
    const ddt = createTestDDT();

    // Test nuovo engine
    const { callbacks: newCallbacks, messages: newMessages, events: newEvents } = createMockCallbacks();
    newEvents.push({ type: 'match', value: 'test@example.com' });
    const newResult = await runDDT(ddt, newCallbacks);

    // Test vecchio engine
    const { callbacks: oldCallbacks, messages: oldMessages, events: oldEvents } = createMockCallbacks();
    oldEvents.push({ type: 'match', value: 'test@example.com' });
    const state: DDTState = {
      memory: {},
      noMatchCounters: {},
      noInputCounters: {},
      notConfirmedCounters: {}
    };
    const oldResult = await executeGetDataHierarchical(ddt, state, oldCallbacks);

    // Confronta risultati
    console.log('[TEST] New engine messages:', newMessages);
    console.log('[TEST] Old engine messages:', oldMessages);
    console.log('[TEST] New result:', newResult);
    console.log('[TEST] Old result:', oldResult);

    // Entrambi dovrebbero avere success
    expect(newResult.success).toBe(oldResult.success);

    // Entrambi dovrebbero avere messaggi
    expect(newMessages.length).toBeGreaterThan(0);
    expect(oldMessages.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// TEST: Confirmation Flow
// ============================================================================

describe('Confirmation Flow Tests', () => {
  test('Confirmation flow: Match → Confirmation → Confirmed → Success (NEW ENGINE)', async () => {
    const ddt = createTestDDT({
      data: {
        id: 'test-main',
        label: 'Test Data',
        required: true,
        steps: [
          {
            type: 'start',
            escalations: [
              {
                level: 1,
                actions: [
                  {
                    actionId: 'sayMessage',
                    actionInstanceId: 'msg-1',
                    parameters: [{ parameterId: 'text', value: 'Please provide data' }]
                  }
                ]
              }
            ]
          },
          {
            type: 'confirmation',
            escalations: [
              {
                level: 1,
                actions: [
                  {
                    actionId: 'sayMessage',
                    actionInstanceId: 'msg-confirm',
                    parameters: [{ parameterId: 'text', value: 'Is this correct?' }]
                  }
                ]
              }
            ]
          },
          {
            type: 'success',
            escalations: [
              {
                level: 1,
                actions: [
                  {
                    actionId: 'sayMessage',
                    actionInstanceId: 'msg-success',
                    parameters: [{ parameterId: 'text', value: 'Thank you!' }]
                  }
                ]
              }
            ]
          }
        ]
      }
    });

    const { callbacks, messages, events } = createMockCallbacks();

    // Simula: match → confirmed (yes/sì)
    events.push({ type: 'match', value: 'test@example.com' });
    events.push({ type: 'match', value: 'sì' }); // Confirmation (yes in Italian)

    const result = await runDDT(ddt, callbacks);

    expect(result.success).toBe(true);
    // Verifica che ci siano messaggi
    expect(messages.length).toBeGreaterThan(0);
    // Verifica che il primo messaggio sia start
    expect(messages[0].stepType).toBe('start');
    // Verifica che l'ultimo messaggio sia success (dopo confirmation)
    const lastMessage = messages[messages.length - 1];
    expect(lastMessage.stepType).toBe('success');
  });

  test('NotConfirmed flow: Match → Confirmation → NotConfirmed → Start (NEW ENGINE)', async () => {
    const ddt = createTestDDT({
      data: {
        id: 'test-main',
        label: 'Test Data',
        required: true,
        steps: [
          {
            type: 'start',
            escalations: [
              {
                level: 1,
                actions: [
                  {
                    actionId: 'sayMessage',
                    actionInstanceId: 'msg-1',
                    parameters: [{ parameterId: 'text', value: 'Please provide data' }]
                  }
                ]
              }
            ]
          },
          {
            type: 'confirmation',
            escalations: [
              {
                level: 1,
                actions: [
                  {
                    actionId: 'sayMessage',
                    actionInstanceId: 'msg-confirm',
                    parameters: [{ parameterId: 'text', value: 'Is this correct?' }]
                  }
                ]
              }
            ]
          },
          {
            type: 'notConfirmed',
            escalations: [
              {
                level: 1,
                actions: [
                  {
                    actionId: 'sayMessage',
                    actionInstanceId: 'msg-not-confirmed',
                    parameters: [{ parameterId: 'text', value: 'Please provide the correct data' }]
                  }
                ]
              }
            ]
          },
          {
            type: 'success',
            escalations: [
              {
                level: 1,
                actions: [
                  {
                    actionId: 'sayMessage',
                    actionInstanceId: 'msg-success',
                    parameters: [{ parameterId: 'text', value: 'Thank you!' }]
                  }
                ]
              }
            ]
          }
        ]
      }
    });

    const { callbacks, messages, events } = createMockCallbacks();

    // Simula: match → notConfirmed (no) → match (correzione) → confirmed
    events.push({ type: 'match', value: 'wrong@example.com' });
    events.push({ type: 'match', value: 'no' }); // NotConfirmed
    events.push({ type: 'match', value: 'correct@example.com' }); // Correzione
    events.push({ type: 'match', value: 'sì' }); // Confirmation (yes)

    const result = await runDDT(ddt, callbacks);

    expect(result.success).toBe(true);
    // Verifica che ci siano messaggi
    expect(messages.length).toBeGreaterThan(0);
    // Verifica che il primo messaggio sia start
    expect(messages[0].stepType).toBe('start');
    // Verifica che l'ultimo messaggio sia success (dopo notConfirmed e correzione)
    const lastMessage = messages[messages.length - 1];
    expect(lastMessage.stepType).toBe('success');
  });
});

// ============================================================================
// TEST: CollectingSub Flow (Main con SubData)
// ============================================================================

describe('CollectingSub Flow Tests', () => {
  test('CollectingSub: Main → Sub → Success (NEW ENGINE)', async () => {
    const data: dataNode = {
      id: 'date-main',
      label: 'Date',
      required: true,
      steps: [
        {
          type: 'start',
          escalations: [
            {
              level: 1,
              actions: [
                {
                  actionId: 'sayMessage',
                  actionInstanceId: 'msg-start',
                  parameters: [{ parameterId: 'text', value: 'Please provide date' }]
                }
              ]
            }
          ]
        },
        {
          type: 'success',
          escalations: [
            {
              level: 1,
              actions: [
                {
                  actionId: 'sayMessage',
                  actionInstanceId: 'msg-success',
                  parameters: [{ parameterId: 'text', value: 'Date collected!' }]
                }
              ]
            }
          ]
        }
      ],
      subData: [
        {
          id: 'day-sub',
          label: 'Day',
          required: true,
          steps: [
            {
              type: 'start',
              escalations: [
                {
                  level: 1,
                  actions: [
                    {
                      actionId: 'sayMessage',
                      actionInstanceId: 'msg-day',
                      parameters: [{ parameterId: 'text', value: 'What day?' }]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          id: 'month-sub',
          label: 'Month',
          required: true,
          steps: [
            {
              type: 'start',
              escalations: [
                {
                  level: 1,
                  actions: [
                    {
                      actionId: 'sayMessage',
                      actionInstanceId: 'msg-month',
                      parameters: [{ parameterId: 'text', value: 'What month?' }]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };

    const ddt = createTestDDT({ data });

    const { callbacks, messages, events } = createMockCallbacks();

    // Simula: raccogli main (date) → day → month → success
    // Nota: dopo aver raccolto il main, passa ai sub
    events.push({ type: 'match', value: '2024-12-15' }); // Main date (trigger per passare ai sub)
    events.push({ type: 'match', value: '15' }); // Day sub
    events.push({ type: 'match', value: 'december' }); // Month sub

    const result = await runDDT(ddt, callbacks);

    expect(result.success).toBe(true);
    // Dovrebbe mostrare messaggi per day e month
    const dayMessage = messages.find(m => m.text?.includes('day') || m.text?.includes('Day'));
    const monthMessage = messages.find(m => m.text?.includes('month') || m.text?.includes('Month'));
    expect(dayMessage || monthMessage).toBeDefined();
  });
});

// ============================================================================
// TEST: Multiple Escalations
// ============================================================================

describe('Multiple Escalations Tests', () => {
  test('Multiple NoMatch escalations (NEW ENGINE)', async () => {
    const ddt = createTestDDT({
      data: {
        id: 'test-main',
        label: 'Test Data',
        required: true,
        steps: [
          {
            type: 'start',
            escalations: [
              {
                level: 1,
                actions: [
                  {
                    actionId: 'sayMessage',
                    actionInstanceId: 'msg-1',
                    parameters: [{ parameterId: 'text', value: 'Please provide data' }]
                  }
                ]
              }
            ]
          },
          {
            type: 'noMatch',
            escalations: [
              {
                level: 1,
                actions: [
                  {
                    actionId: 'sayMessage',
                    actionInstanceId: 'msg-noMatch-1',
                    parameters: [{ parameterId: 'text', value: 'First escalation: Please try again' }]
                  }
                ]
              },
              {
                level: 2,
                actions: [
                  {
                    actionId: 'sayMessage',
                    actionInstanceId: 'msg-noMatch-2',
                    parameters: [{ parameterId: 'text', value: 'Second escalation: I still did not understand' }]
                  }
                ]
              },
              {
                level: 3,
                actions: [
                  {
                    actionId: 'sayMessage',
                    actionInstanceId: 'msg-noMatch-3',
                    parameters: [{ parameterId: 'text', value: 'Third escalation: Last attempt' }]
                  }
                ]
              }
            ]
          },
          {
            type: 'success',
            escalations: [
              {
                level: 1,
                actions: [
                  {
                    actionId: 'sayMessage',
                    actionInstanceId: 'msg-success',
                    parameters: [{ parameterId: 'text', value: 'Thank you!' }]
                  }
                ]
              }
            ]
          }
        ]
      }
    });

    const { callbacks, messages, events } = createMockCallbacks();

    // Simula: noMatch (1) → noMatch (2) → match
    events.push({ type: 'noMatch' }); // First escalation
    events.push({ type: 'noMatch' }); // Second escalation
    events.push({ type: 'match', value: 'test@example.com' }); // Success

    const result = await runDDT(ddt, callbacks);

    expect(result.success).toBe(true);
    // Dovrebbe mostrare escalation level 1 e 2
    const escalation1 = messages.find(m => m.text?.includes('First escalation'));
    const escalation2 = messages.find(m => m.text?.includes('Second escalation'));
    expect(escalation1).toBeDefined();
    expect(escalation2).toBeDefined();
  });
});

// ============================================================================
// TEST: Edge Cases
// ============================================================================

describe('Edge Cases Tests', () => {
  test('Empty input handling (NEW ENGINE)', async () => {
    const ddt = createTestDDT();
    const { callbacks, messages, events } = createMockCallbacks();

    // Simula: noInput → match
    events.push({ type: 'noInput' });
    events.push({ type: 'match', value: 'test@example.com' });

    const result = await runDDT(ddt, callbacks);

    expect(result.success).toBe(true);
    const noInputMessage = messages.find(m => m.stepType === 'noInput');
    expect(noInputMessage).toBeDefined();
  });

  test('Multiple data handling (NEW ENGINE)', async () => {
    const data1: dataNode = {
      id: 'main-1',
      label: 'First Data',
      required: true,
      steps: [
        {
          type: 'start',
          escalations: [
            {
              level: 1,
              actions: [
                {
                  actionId: 'sayMessage',
                  actionInstanceId: 'msg-1',
                  parameters: [{ parameterId: 'text', value: 'First data?' }]
                }
              ]
            }
          ]
        },
        {
          type: 'success',
          escalations: [
            {
              level: 1,
              actions: [
                {
                  actionId: 'sayMessage',
                  actionInstanceId: 'msg-success-1',
                  parameters: [{ parameterId: 'text', value: 'First done!' }]
                }
              ]
            }
          ]
        }
      ]
    };

    const data2: dataNode = {
      id: 'main-2',
      label: 'Second Data',
      required: true,
      steps: [
        {
          type: 'start',
          escalations: [
            {
              level: 1,
              actions: [
                {
                  actionId: 'sayMessage',
                  actionInstanceId: 'msg-2',
                  parameters: [{ parameterId: 'text', value: 'Second data?' }]
                }
              ]
            }
          ]
        },
        {
          type: 'success',
          escalations: [
            {
              level: 1,
              actions: [
                {
                  actionId: 'sayMessage',
                  actionInstanceId: 'msg-success-2',
                  parameters: [{ parameterId: 'text', value: 'Second done!' }]
                }
              ]
            }
          ]
        }
      ]
    };

    const ddt = createTestDDT({
      data: [data1, data2] as any
    });

    const { callbacks, messages, events } = createMockCallbacks();

    // Simula: raccogli main-1 → main-2
    events.push({ type: 'match', value: 'value1' }); // Main 1
    events.push({ type: 'match', value: 'value2' }); // Main 2

    const result = await runDDT(ddt, callbacks);

    expect(result.success).toBe(true);
    // Dovrebbe processare entrambi i data
    const firstMessage = messages.find(m => m.text?.includes('First'));
    const secondMessage = messages.find(m => m.text?.includes('Second'));
    expect(firstMessage).toBeDefined();
    expect(secondMessage).toBeDefined();
  });
});

