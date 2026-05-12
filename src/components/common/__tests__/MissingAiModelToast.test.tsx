// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { MissingAiModelToast } from '../MissingAiModelToast';
import {
  OMNIA_OPEN_STUDIO_SETTINGS_EVENT,
  type OmniaOpenStudioSettingsEventDetail,
} from '../../../BackendBuilder/state/BackendBuilderContext';

describe('MissingAiModelToast', () => {
  let dispatchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dispatchSpy = vi.spyOn(document, 'dispatchEvent');
    try {
      window.sessionStorage.clear();
    } catch {
      /* ignore: sessionStorage may be unavailable in some test envs */
    }
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
  });

  it('shows the localized headline so the user understands the missing-model error immediately', () => {
    render(<MissingAiModelToast onDismiss={vi.fn()} />);
    expect(screen.getByText('Nessun modello IA definito')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scegli il modello/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /chiudi avviso/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('dispatches the open-settings event with step=omniaTutor + reason=missing-ai-model and primes the banner flag when "Scegli il modello" is clicked', () => {
    const onDismiss = vi.fn();
    render(<MissingAiModelToast onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: /scegli il modello/i }));

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    const event = dispatchSpy.mock.calls[0]?.[0] as CustomEvent<OmniaOpenStudioSettingsEventDetail>;
    expect(event.type).toBe(OMNIA_OPEN_STUDIO_SETTINGS_EVENT);
    expect(event.detail).toEqual({ step: 'omniaTutor', reason: 'missing-ai-model' });
    expect(event.bubbles).toBe(true);
    expect(window.sessionStorage.getItem('omnia.aiModel.missingReason')).toBe('missing-ai-model');

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('only invokes onDismiss when the close button is clicked, without dispatching any settings event', () => {
    const onDismiss = vi.fn();
    render(<MissingAiModelToast onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: /chiudi avviso/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).not.toHaveBeenCalled();
  });
});
