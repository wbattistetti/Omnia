import { useRef, useMemo, useState } from 'react';

export type ExtractorType = 'regex' | 'extractor' | 'ner' | 'llm';

interface UseEditorModeOptions {
  initialValue: string;
  templateValue: string;
  hasUserEdited: boolean;
  extractorType: ExtractorType;
}

/**
 * Hook for determining Create vs Refine mode in extractor editors
 * Unifies logic across all editors (Regex, Extractor, NER, LLM)
 */
export function useEditorMode({
  initialValue,
  templateValue,
  hasUserEdited,
  extractorType,
}: UseEditorModeOptions) {
  const wasInitiallyEmpty = useRef(!initialValue || initialValue.trim().length === 0);
  const [currentValue, setCurrentValue] = useState(initialValue);

  const isTemplate = useMemo(() => {
    const normalized = String(currentValue || '').trim();
    const templateNormalized = String(templateValue || '').trim();
    return normalized === templateNormalized;
  }, [currentValue, templateValue]);

  const isCreateMode = wasInitiallyEmpty.current && (isTemplate || !hasUserEdited);
  const isRefineMode = !wasInitiallyEmpty.current || hasUserEdited || !isTemplate;

  const getButtonLabel = () => {
    const typeLabels: Record<ExtractorType, string> = {
      regex: 'Regex',
      extractor: 'Extractor',
      ner: 'NER',
      llm: 'LLM Prompt',
    };
    return isCreateMode ? `Create ${typeLabels[extractorType]}` : `Refine ${typeLabels[extractorType]}`;
  };

  return {
    currentValue,
    setCurrentValue,
    isCreateMode,
    isRefineMode,
    isTemplate,
    getButtonLabel,
    wasInitiallyEmpty: wasInitiallyEmpty.current,
  };
}

