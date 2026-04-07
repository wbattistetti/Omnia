/**
 * Choice panel: manual / wizard / optional adapt from embedding suggestion.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskCreationChoicePanel } from '../TaskCreationChoicePanel';

describe('TaskCreationChoicePanel', () => {
  it('shows only manual and wizard when no embedding match', () => {
    render(
      <TaskCreationChoicePanel onChooseManual={vi.fn()} onChooseWizard={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: /Crea manualmente/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Usa wizard/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Adatta template trovato/i })).toBeNull();
  });

  it('shows third button with template name when embedding match and handler provided', () => {
    const onAdapt = vi.fn();
    render(
      <TaskCreationChoicePanel
        onChooseManual={vi.fn()}
        onChooseWizard={vi.fn()}
        embeddingMatchTemplateName="chiedi nome"
        onChooseAdaptTemplate={onAdapt}
      />
    );
    const adaptBtn = screen.getByRole('button', { name: /Adatta template trovato \(chiedi nome\)/i });
    fireEvent.click(adaptBtn);
    expect(onAdapt).toHaveBeenCalledTimes(1);
  });
});
