/**
 * Component tests for shared review UI (@omnia/domain-components).
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { TaskType } from '@types/taskTypes';
import { UseCaseReviewPanel } from '../UseCaseReviewPanel';
import { UseCaseActionsReadOnlyList } from '../UseCaseActionsReadOnlyList';

function minimalUseCase(overrides: Partial<AIAgentUseCase> = {}): AIAgentUseCase {
  return {
    id: 'uc-1',
    label: 'Prenotazione',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    dialogue: [{ turn_id: 't1', role: 'assistant', content: 'Ciao', editable: true }],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
    scenario: { llm: 'Scenario iniziale', descrittivo: 'Scenario iniziale' },
    response: {
      tasks: [
        {
          id: 'act-1',
          type: TaskType.BackendCall,
          templateId: 'backendCall',
          label: 'Chiama API',
          parameters: [],
        },
      ],
    },
    ...overrides,
  };
}

describe('UseCaseActionsReadOnlyList', () => {
  it('renders action labels via domain-core summarizeUseCaseActionLabel', () => {
    render(<UseCaseActionsReadOnlyList useCase={minimalUseCase()} />);
    expect(screen.getByText('Chiama API')).toBeInTheDocument();
  });

  it('shows empty state when no actions', () => {
    render(
      <UseCaseActionsReadOnlyList
        useCase={minimalUseCase({ response: { tasks: [] } })}
      />
    );
    expect(screen.getByText(/Nessuna azione collegata/i)).toBeInTheDocument();
  });
});

describe('UseCaseReviewPanel', () => {
  it('renders use case and patches scenario on edit', () => {
    const setUseCases = vi.fn();
    render(
      <UseCaseReviewPanel
        useCases={[minimalUseCase()]}
        setUseCases={setUseCases}
        useCaseCategories={[]}
        error={null}
        onDismissError={() => {}}
      />
    );

    expect(screen.getByText('Prenotazione')).toBeInTheDocument();
    const scenario = screen.getByPlaceholderText(/Descrizione scenario/i);
    fireEvent.change(scenario, { target: { value: 'Scenario aggiornato' } });
    expect(setUseCases).toHaveBeenCalled();
  });

  it('shows read-only actions section', () => {
    render(
      <UseCaseReviewPanel
        useCases={[minimalUseCase()]}
        setUseCases={vi.fn()}
        useCaseCategories={[]}
        error={null}
        onDismissError={() => {}}
      />
    );
    expect(screen.getByText('Azioni')).toBeInTheDocument();
    expect(screen.getByText('Chiama API')).toBeInTheDocument();
  });

  it('compose toolbar adds a use case when enabled', () => {
    const setUseCases = vi.fn();
    render(
      <UseCaseReviewPanel
        useCases={[]}
        setUseCases={setUseCases}
        useCaseCategories={[]}
        error={null}
        onDismissError={() => {}}
        composeEnabled
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Aggiungi/i }));
    expect(setUseCases).toHaveBeenCalled();
  });
});
