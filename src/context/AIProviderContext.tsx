/**
 * Global AI provider + model selection (designer-side LLM).
 *
 * Single source of truth: the model id is stored verbatim in `localStorage` and exposed via
 * `useAIProvider().model`. The list of valid models is fetched live from the backend catalog
 * (`/api/ia-catalog/ui/models`) and consumed by `OmniaTutorSetup` — this context purposely does
 * NOT keep a hardcoded model whitelist anymore (the previous validation effect was silently
 * overwriting user picks like `gpt-5` because they weren't in the legacy table).
 *
 * Consumers that need to disable an AI button when no model is configured should check
 * `useAiBusyLabel().hasModel` (true when `model !== ''`).
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type AIProvider = 'groq' | 'openai';
export type AIModel = string;

export interface AIProviderConfig {
  id: AIProvider;
  label: string;
}

/** Provider metadata only (label for UI). No model whitelist, no default — those are dynamic. */
export const AI_PROVIDERS: Record<AIProvider, AIProviderConfig> = {
  groq: { id: 'groq', label: 'Groq (Llama)' },
  openai: { id: 'openai', label: 'OpenAI' },
};

interface AIProviderContextType {
  provider: AIProvider;
  model: AIModel;
  setProvider: (provider: AIProvider) => void;
  setModel: (model: AIModel) => void;
  providerConfig: AIProviderConfig;
}

const AIProviderContext = createContext<AIProviderContextType | undefined>(undefined);

const STORAGE_KEY_PROVIDER = 'omnia.aiProvider';
const STORAGE_KEY_MODEL = 'omnia.aiModel';

function readStoredProvider(): AIProvider {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PROVIDER);
    return stored === 'openai' || stored === 'groq' ? stored : 'groq';
  } catch {
    return 'groq';
  }
}

function readStoredModel(): AIModel {
  try {
    return localStorage.getItem(STORAGE_KEY_MODEL) ?? '';
  } catch {
    return '';
  }
}

export function AIProviderProvider({ children }: { children: ReactNode }) {
  const [provider, setProviderState] = useState<AIProvider>(readStoredProvider);
  const [model, setModelState] = useState<AIModel>(readStoredModel);

  const setProvider = (newProvider: AIProvider): void => {
    setProviderState(newProvider);
    try {
      localStorage.setItem(STORAGE_KEY_PROVIDER, newProvider);
    } catch {
      // localStorage may be unavailable in private mode; selection still applies for the session.
    }
  };

  const setModel = (newModel: AIModel): void => {
    setModelState(newModel);
    try {
      localStorage.setItem(STORAGE_KEY_MODEL, newModel ?? '');
    } catch {
      // see setProvider note above
    }
  };

  useEffect(() => {
    try {
      (window as unknown as { __AI_PROVIDER?: AIProvider }).__AI_PROVIDER = provider;
    } catch {
      // window globals are best-effort backwards compatibility for legacy callers
    }
  }, [provider]);

  const providerConfig = AI_PROVIDERS[provider];

  return (
    <AIProviderContext.Provider
      value={{ provider, model, setProvider, setModel, providerConfig }}
    >
      {children}
    </AIProviderContext.Provider>
  );
}

export function useAIProvider(): AIProviderContextType {
  const context = useContext(AIProviderContext);
  if (context === undefined) {
    throw new Error('useAIProvider must be used within AIProviderProvider');
  }
  return context;
}
