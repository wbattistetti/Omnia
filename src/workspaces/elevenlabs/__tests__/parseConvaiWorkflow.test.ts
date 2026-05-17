import { describe, expect, it } from 'vitest';
import {
  extractGlobalPromptFromConversationConfig,
  parseConvaiWorkflowFromConversationConfig,
} from '../parseConvaiWorkflow';

describe('parseConvaiWorkflowFromConversationConfig', () => {
  it('parses nodes and llm edges', () => {
    const cc = {
      agent: { prompt: { prompt: 'Global system' } },
      workflow: {
        nodes: {
          start_node: { type: 'start', edge_order: ['e1'] },
          medico: {
            type: 'override_agent',
            label: 'Preferenza medico',
            additional_prompt: 'Chiedi il dottore {{dottore}}',
            edge_order: ['e2'],
          },
          end_node: { type: 'end' },
        },
        edges: {
          e1: {
            source: 'start_node',
            target: 'medico',
            forward_condition: { type: 'unconditional' },
          },
          e2: {
            source: 'medico',
            target: 'end_node',
            forward_condition: { type: 'llm', condition: 'Scelta effettuata' },
          },
        },
      },
    };
    const g = parseConvaiWorkflowFromConversationConfig(cc, 'Global system');
    expect(g.nodes.length).toBe(3);
    const medico = g.nodes.find((n) => n.id === 'medico');
    expect(medico?.label).toBe('Preferenza medico');
    expect(medico?.promptText).toContain('{{dottore}}');
    expect(g.edges.length).toBe(2);
    const e2 = g.edges.find((e) => e.id === 'e2');
    expect(e2?.conditionKind).toBe('llm');
    expect(e2?.conditionText).toBe('Scelta effettuata');
    expect(medico?.inheritsGlobalPrompt).not.toBe(true);
  });

  it('does not merge global prompt into subagent promptText', () => {
    const global = 'Prompt segreteria Paros globale';
    const g = parseConvaiWorkflowFromConversationConfig(
      {
        agent: { prompt: { prompt: global } },
        workflow: {
          nodes: {
            visita: { type: 'override_agent', label: 'Chiedi visita', edge_order: [] },
            medico: {
              type: 'override_agent',
              label: 'Chiedi medico',
              additional_prompt: 'Solo override medico',
              edge_order: [],
            },
          },
          edges: {},
        },
      },
      global
    );
    const visita = g.nodes.find((n) => n.id === 'visita');
    const medico = g.nodes.find((n) => n.id === 'medico');
    expect(visita?.promptText).toBe('');
    expect(visita?.inheritsGlobalPrompt).toBe(true);
    expect(medico?.promptText).toBe('Solo override medico');
    expect(medico?.inheritsGlobalPrompt).not.toBe(true);
    expect(visita?.promptText).not.toContain('Paros');
  });

  it('parses node canvas position', () => {
    const g = parseConvaiWorkflowFromConversationConfig({
      workflow: {
        nodes: {
          n1: { type: 'start', position: { x: 100, y: 200 } },
        },
        edges: {},
      },
    });
    expect(g.nodes[0]?.position).toEqual({ x: 100, y: 200 });
  });

  it('extracts global prompt', () => {
    expect(
      extractGlobalPromptFromConversationConfig({
        agent: { prompt: { prompt: '  Hello  ' } },
      })
    ).toBe('Hello');
  });
});
