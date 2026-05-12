// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ModelTreePicker } from '../ModelTreePicker';
import type { AvailableLlmModelOption } from '@hooks/useAvailableLlmModels';

const PROVIDERS = [
  { id: 'groq' as const, label: 'Groq' },
  { id: 'openai' as const, label: 'OpenAI' },
];

function opt(provider: 'groq' | 'openai', id: string): AvailableLlmModelOption {
  return { provider, id, label: `[${provider}] ${id}` };
}

const FIXTURE: AvailableLlmModelOption[] = [
  opt('openai', 'gpt-5'),
  opt('openai', 'gpt-4o-mini'),
  opt('openai', 'gpt-4o'),
  opt('openai', 'dall-e-3'),
  opt('groq', 'llama-3.3-70b-versatile'),
  opt('groq', 'mixtral-8x7b-32768'),
];

describe('ModelTreePicker', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the trigger placeholder when no model is selected', () => {
    render(
      <ModelTreePicker
        value=""
        options={FIXTURE}
        providers={PROVIDERS}
        onChange={vi.fn()}
        placeholder="Scegli un modello"
      />
    );
    expect(screen.getByRole('button', { name: /scegli un modello/i })).toBeInTheDocument();
  });

  it('shows the provider hint pill and the selected model id on the trigger', () => {
    render(
      <ModelTreePicker
        value="gpt-5"
        options={FIXTURE}
        providers={PROVIDERS}
        onChange={vi.fn()}
      />
    );
    const trigger = screen.getByRole('button');
    expect(within(trigger).getByText('OpenAI')).toBeInTheDocument();
    expect(within(trigger).getByText('gpt-5')).toBeInTheDocument();
  });

  it('opens the popover on click and lists provider rows with model counts', () => {
    render(
      <ModelTreePicker value="" options={FIXTURE} providers={PROVIDERS} onChange={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button'));
    const tree = screen.getByRole('tree');
    expect(within(tree).getByText('Groq')).toBeInTheDocument();
    expect(within(tree).getByText('OpenAI')).toBeInTheDocument();
    expect(within(tree).getByText('2')).toBeInTheDocument();
    expect(within(tree).getByText('4')).toBeInTheDocument();
  });

  it('auto-expands the provider/ancestors of the currently selected model and highlights the node', () => {
    render(
      <ModelTreePicker
        value="gpt-4o"
        options={FIXTURE}
        providers={PROVIDERS}
        onChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    const selectedNode = screen.getByRole('treeitem', { selected: true });
    expect(selectedNode).toHaveTextContent('4o');
  });

  it('forwards onChange with the complete model id when a deep node is clicked', () => {
    const onChange = vi.fn();
    render(
      <ModelTreePicker value="" options={FIXTURE} providers={PROVIDERS} onChange={onChange} />
    );
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('OpenAI'));
    fireEvent.click(screen.getByRole('button', { name: 'Espandi gpt' }));
    fireEvent.click(screen.getByText('5'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('gpt-5', 'openai');
  });

  it('allows a branch node to be selected when it is also a real model', () => {
    const onChange = vi.fn();
    render(
      <ModelTreePicker value="" options={FIXTURE} providers={PROVIDERS} onChange={onChange} />
    );
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('OpenAI'));
    fireEvent.click(screen.getByRole('button', { name: 'Espandi gpt' }));
    fireEvent.click(screen.getByText('4o'));
    expect(onChange).toHaveBeenCalledWith('gpt-4o', 'openai');
  });

  it('filters by query and prunes empty branches (no "OpenAI" group when only mixtral matches)', () => {
    render(
      <ModelTreePicker value="" options={FIXTURE} providers={PROVIDERS} onChange={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button'));
    const search = screen.getByPlaceholderText(/cerca modello/i);
    fireEvent.change(search, { target: { value: 'mixtral' } });
    expect(screen.queryByText('OpenAI')).not.toBeInTheDocument();
    expect(screen.getByText('mixtral')).toBeInTheDocument();
    expect(screen.getByText('8x7b')).toBeInTheDocument();
    expect(screen.getByText('32768')).toBeInTheDocument();
  });

  it('renders a "no results" placeholder when the query matches nothing', () => {
    render(
      <ModelTreePicker value="" options={FIXTURE} providers={PROVIDERS} onChange={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText(/cerca modello/i), {
      target: { value: 'nonexistent-xyz' },
    });
    expect(screen.getByText(/nessun modello corrisponde/i)).toBeInTheDocument();
  });
});
