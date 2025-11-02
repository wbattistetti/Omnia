import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type AIProvider = 'groq' | 'openai';
export type AIModel = string;

export interface AIModelConfig {
  id: string;
  label: string;
  description?: string;
}

export interface AIProviderConfig {
  id: AIProvider;
  label: string;
  models: AIModelConfig[];
  defaultModel: string;
}

// Available providers and their models
export const AI_PROVIDERS: Record<AIProvider, AIProviderConfig> = {
  groq: {
    id: 'groq',
    label: 'Groq (Llama)',
    models: [
      { id: 'llama-3.1-70b-instruct', label: 'Llama 3.1 70B', description: 'High performance - 70B parameters' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', description: 'Fast - 8B parameters' },
      { id: 'llama3-70b-8192', label: 'Llama3 70B (8192)', description: 'Legacy 70B model with 8K context' },
      { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', description: 'Mixtral model with 32K context' },
      { id: 'gemma-7b-it', label: 'Gemma 7B IT', description: 'Gemma 7B instruction-tuned' },
    ],
    defaultModel: 'llama-3.1-70b-instruct',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    models: [
      { id: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo', description: 'Most capable model' },
      { id: 'gpt-4', label: 'GPT-4', description: 'High quality' },
      { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Fast and efficient' },
    ],
    defaultModel: 'gpt-4-turbo-preview',
  },
};

interface AIProviderContextType {
  provider: AIProvider;
  model: AIModel;
  setProvider: (provider: AIProvider) => void;
  setModel: (model: AIModel) => void;
  providerConfig: AIProviderConfig;
  availableModels: AIModelConfig[];
}

const AIProviderContext = createContext<AIProviderContextType | undefined>(undefined);

const STORAGE_KEY_PROVIDER = 'omnia.aiProvider';
const STORAGE_KEY_MODEL = 'omnia.aiModel';

export function AIProviderProvider({ children }: { children: ReactNode }) {
  // Load from localStorage or use defaults
  const [provider, setProviderState] = useState<AIProvider>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PROVIDER);
      return (stored as AIProvider) || 'groq';
    } catch {
      return 'groq';
    }
  });

  const [model, setModelState] = useState<AIModel>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MODEL);
      if (stored) return stored;
      // If no stored model, use default for current provider
      return AI_PROVIDERS[provider].defaultModel;
    } catch {
      return AI_PROVIDERS[provider].defaultModel;
    }
  });

  // Ensure model is valid for current provider, reset to default if not
  useEffect(() => {
    const providerConfig = AI_PROVIDERS[provider];
    const isValidModel = providerConfig.models.some(m => m.id === model);
    if (!isValidModel) {
      setModelState(providerConfig.defaultModel);
      try {
        localStorage.setItem(STORAGE_KEY_MODEL, providerConfig.defaultModel);
      } catch {}
    }
  }, [provider, model]);

  const setProvider = (newProvider: AIProvider) => {
    setProviderState(newProvider);
    // Reset model to default for new provider
    const newModel = AI_PROVIDERS[newProvider].defaultModel;
    setModelState(newModel);
    try {
      localStorage.setItem(STORAGE_KEY_PROVIDER, newProvider);
      localStorage.setItem(STORAGE_KEY_MODEL, newModel);
      // Also set global window variable for backward compatibility
      (window as any).__AI_PROVIDER = newProvider;
    } catch {}
  };

  const setModel = (newModel: AIModel) => {
    setModelState(newModel);
    try {
      localStorage.setItem(STORAGE_KEY_MODEL, newModel);
    } catch {}
  };

  // Sync window variable for backward compatibility
  useEffect(() => {
    try {
      (window as any).__AI_PROVIDER = provider;
    } catch {}
  }, [provider]);

  const providerConfig = AI_PROVIDERS[provider];
  const availableModels = providerConfig.models;

  return (
    <AIProviderContext.Provider
      value={{
        provider,
        model,
        setProvider,
        setModel,
        providerConfig,
        availableModels,
      }}
    >
      {children}
    </AIProviderContext.Provider>
  );
}

export function useAIProvider() {
  const context = useContext(AIProviderContext);
  if (context === undefined) {
    throw new Error('useAIProvider must be used within AIProviderProvider');
  }
  return context;
}

