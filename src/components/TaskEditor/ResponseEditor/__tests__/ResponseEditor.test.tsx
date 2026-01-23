import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ResponseEditor from '../ResponseEditor';

// Mock dei moduli
vi.mock('../ResponseEditorUI', () => ({
  default: ({ onSelectNode, editorState }: any) => (
    <div data-testid="response-editor-ui">
      <button 
        data-testid="select-data" 
        onClick={() => onSelectNode(null)}
      >
        data
      </button>
      <button 
        data-testid="select-subdata-0" 
        onClick={() => onSelectNode(0)}
      >
        SubData 0
      </button>
      <button 
        data-testid="select-subdata-1" 
        onClick={() => onSelectNode(1)}
      >
        SubData 1
      </button>
      <div data-testid="selected-step">{editorState.selectedStep}</div>
    </div>
  )
}));

vi.mock('../treeFactories', () => ({
  estraiNodiDaDDT: vi.fn(() => []),
  insertNodeAt: vi.fn(),
  removeNodePure: vi.fn(),
  addNode: vi.fn()
}));

vi.mock('../useResponseEditorState', () => ({
  useResponseEditorState: vi.fn(() => ({
    state: {
      selectedStep: 'start',
      actionCatalog: [],
      showLabel: false,
      activeDragAction: null,
      nodes: []
    },
    dispatch: vi.fn(),
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn()
  }))
}));

describe('ResponseEditor', () => {
  const mockDDT = {
    label: 'Date of birth',
    dataType: { type: 'date' },
    data: {
      steps: [
        { type: 'start', escalations: [] },
        { type: 'noMatch', escalations: [] },
        { type: 'success', escalations: [] }
      ],
      subData: [
        {
          label: 'Day',
          steps: [
            { type: 'start', escalations: [] },
            { type: 'noMatch', escalations: [] },
            { type: 'success', escalations: [] }
          ]
        },
        {
          label: 'Month',
          steps: [
            { type: 'start', escalations: [] },
            { type: 'noMatch', escalations: [] },
            { type: 'success', escalations: [] }
          ]
        }
      ]
    }
  };

  const mockTranslations = {};

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should select first step automatically when opened', () => {
    render(
      <ResponseEditor 
        ddt={mockDDT} 
        translations={mockTranslations} 
        lang="it" 
      />
    );

    expect(screen.getByTestId('selected-step')).toHaveTextContent('start');
  });

  it('should not reset step when switching from data to subData with same step available', () => {
    render(
      <ResponseEditor 
        ddt={mockDDT} 
        translations={mockTranslations} 
        lang="it" 
      />
    );

    // Verifica che lo step iniziale sia 'start'
    expect(screen.getByTestId('selected-step')).toHaveTextContent('start');

    // Cambia a subData 0 (che ha lo stesso step 'start')
    fireEvent.click(screen.getByTestId('select-subdata-0'));

    // Lo step dovrebbe rimanere 'start'
    expect(screen.getByTestId('selected-step')).toHaveTextContent('start');
  });

  it('should select first available step when switching to node without current step', () => {
    // Mock DDT con subData che non ha lo step 'start'
    const ddtWithoutStart = {
      ...mockDDT,
      data: {
        ...mockDDT.data,
        subData: [
          {
            label: 'Day',
            steps: [
              { type: 'noMatch', escalations: [] },
              { type: 'success', escalations: [] }
            ]
          }
        ]
      }
    };

    render(
      <ResponseEditor 
        ddt={ddtWithoutStart} 
        translations={mockTranslations} 
        lang="it" 
      />
    );

    // Verifica che lo step iniziale sia 'start'
    expect(screen.getByTestId('selected-step')).toHaveTextContent('start');

    // Cambia a subData 0 (che non ha lo step 'start')
    fireEvent.click(screen.getByTestId('select-subdata-0'));

    // Lo step dovrebbe cambiare al primo disponibile ('noMatch')
    expect(screen.getByTestId('selected-step')).toHaveTextContent('noMatch');
  });

  it('should maintain step when switching between nodes with same step available', () => {
    render(
      <ResponseEditor 
        ddt={mockDDT} 
        translations={mockTranslations} 
        lang="it" 
      />
    );

    // Verifica che lo step iniziale sia 'start'
    expect(screen.getByTestId('selected-step')).toHaveTextContent('start');

    // Cambia a subData 0
    fireEvent.click(screen.getByTestId('select-subdata-0'));
    expect(screen.getByTestId('selected-step')).toHaveTextContent('start');

    // Cambia a subData 1
    fireEvent.click(screen.getByTestId('select-subdata-1'));
    expect(screen.getByTestId('selected-step')).toHaveTextContent('start');

    // Torna a data
    fireEvent.click(screen.getByTestId('select-data'));
    expect(screen.getByTestId('selected-step')).toHaveTextContent('start');
  });
}); 