/**
 * Tests for project vs browser language resolution for AI Agent design prompts.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAiAgentOutputLanguage } from './resolveAiAgentOutputLanguage';

/** In-memory store: global test setup mocks localStorage with vi.fn() (no real storage). */
const lsStore: Record<string, string> = {};

describe('resolveAiAgentOutputLanguage', () => {
  beforeEach(() => {
    Object.keys(lsStore).forEach((k) => {
      delete lsStore[k];
    });
    vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
      Object.prototype.hasOwnProperty.call(lsStore, key) ? lsStore[key] : null
    );
    vi.mocked(localStorage.setItem).mockImplementation((key: string, value: string) => {
      lsStore[key] = value;
    });
    vi.mocked(localStorage.clear).mockImplementation(() => {
      Object.keys(lsStore).forEach((k) => {
        delete lsStore[k];
      });
    });
  });

  it('maps valid project.lang it to it-IT', () => {
    localStorage.setItem('project.lang', 'it');
    expect(resolveAiAgentOutputLanguage()).toEqual({ tag: 'it-IT', source: 'project' });
  });

  it('maps valid project.lang en to en-US', () => {
    localStorage.setItem('project.lang', 'en');
    expect(resolveAiAgentOutputLanguage()).toEqual({ tag: 'en-US', source: 'project' });
  });

  it('maps valid project.lang pt to pt-BR', () => {
    localStorage.setItem('project.lang', 'pt');
    expect(resolveAiAgentOutputLanguage()).toEqual({ tag: 'pt-BR', source: 'project' });
  });

  it('ignores invalid project.lang and uses navigator.language', () => {
    localStorage.setItem('project.lang', 'xx');
    const spy = vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('fr-FR');
    expect(resolveAiAgentOutputLanguage()).toEqual({ tag: 'fr-FR', source: 'browser' });
    spy.mockRestore();
  });

  it('normalizes underscores in navigator.language', () => {
    const spy = vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('en_GB');
    expect(resolveAiAgentOutputLanguage().tag).toBe('en-GB');
    spy.mockRestore();
  });
});
