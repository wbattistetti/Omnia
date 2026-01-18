// categoryPresets.ts
// Preset categories per task con supporto multilingua
// Le categorie sono metadati semantici che influenzano icona/colore ma non la logica tecnica

import { getIconComponent } from '../components/TaskEditor/ResponseEditor/icons';

export interface CategoryPreset {
  id: string;
  icons: {
    icon: string; // Nome icona Lucide
    color: string; // Colore hex
  };
  labels: {
    IT: string;
    EN: string;
    PT: string;
  };
  description: {
    IT: string;
    EN: string;
    PT: string;
  };
  // ✅ Mapping category → mainData label per ogni lingua
  mainDataLabels: {
    IT: string;
    EN: string;
    PT: string;
  };
  // ✅ Valori predefiniti (solo per confirmation)
  defaultValues?: {
    IT: string[];
    EN: string[];
    PT: string[];
  };
}

export const PRESET_CATEGORIES: Record<string, CategoryPreset> = {
  // SayMessage categories (opzionali, per UI/UX)
  'greeting': {
    id: 'greeting',
    icons: { icon: 'Sun', color: '#fbbf24' },
    labels: { IT: 'Saluto', EN: 'Greeting', PT: 'Saudação' },
    description: { IT: 'Messaggi di benvenuto', EN: 'Welcome messages', PT: 'Mensagens de boas-vindas' },
    mainDataLabels: { IT: '', EN: '', PT: '' } // Non applicabile per SayMessage
  },
  'farewell': {
    id: 'farewell',
    icons: { icon: 'Wave', color: '#3b82f6' },
    labels: { IT: 'Congedo', EN: 'Farewell', PT: 'Despedida' },
    description: { IT: 'Messaggi di commiato', EN: 'Farewell messages', PT: 'Mensagens de despedida' },
    mainDataLabels: { IT: '', EN: '', PT: '' }
  },
  'info-short': {
    id: 'info-short',
    icons: { icon: 'MessageSquare', color: '#10b981' },
    labels: { IT: 'Informazione Breve', EN: 'Short Information', PT: 'Informação Curta' },
    description: { IT: 'Messaggi informativi concisi', EN: 'Concise informational messages', PT: 'Mensagens informativas concisas' },
    mainDataLabels: { IT: '', EN: '', PT: '' }
  },
  'info-long': {
    id: 'info-long',
    icons: { icon: 'FileText', color: '#06b6d4' },
    labels: { IT: 'Informazione Dettagliata', EN: 'Detailed Information', PT: 'Informação Detalhada' },
    description: { IT: 'Messaggi informativi estesi', EN: 'Extended informational messages', PT: 'Mensagens informativas estendidas' },
    mainDataLabels: { IT: '', EN: '', PT: '' }
  },

  // DataRequest categories (SOLO queste 3 a livello di nodo)
  'problem-classification': {
    id: 'problem-classification',
    icons: { icon: 'GitBranch', color: '#f59e0b' },
    labels: { IT: 'Classificazione Problema', EN: 'Problem Classification', PT: 'Classificação de Problema' },
    description: {
      IT: 'Classificazione di intenti/problemi (es. motivo della chiamata)',
      EN: 'Intent/problem classification (e.g. call reason)',
      PT: 'Classificação de intenções/problemas (ex. motivo da chamada)'
    },
    mainDataLabels: {
      IT: 'Motivo della chiamata',
      EN: 'Call reason',
      PT: 'Motivo da chamada'
    }
  },
  'choice': {
    id: 'choice',
    icons: { icon: 'List', color: '#6366f1' },
    labels: { IT: 'Scelta tra Opzioni', EN: 'Choice', PT: 'Escolha' },
    description: {
      IT: 'Scelta tra opzioni predefinite',
      EN: 'Choice among predefined options',
      PT: 'Escolha entre opções predefinidas'
    },
    mainDataLabels: {
      IT: 'Scelta',
      EN: 'Choice',
      PT: 'Escolha'
    }
  },
  'confirmation': {
    id: 'confirmation',
    icons: { icon: 'CheckCircle', color: '#10b981' },
    labels: { IT: 'Conferma', EN: 'Confirmation', PT: 'Confirmação' },
    description: {
      IT: 'Conferma sì/no',
      EN: 'Yes/no confirmation',
      PT: 'Confirmação sim/não'
    },
    mainDataLabels: {
      IT: 'Conferma',
      EN: 'Confirmation',
      PT: 'Confirmação'
    },
    defaultValues: {
      IT: ['Sì', 'No'],
      EN: ['Yes', 'No'],
      PT: ['Sim', 'Não']
    }
  }
};

/**
 * Ottiene la label del mainData per una categoria nella lingua specificata
 */
export function getMainDataLabelForCategory(
  category: string,
  locale: 'it' | 'en' | 'pt' = 'it'
): string | null {
  const preset = PRESET_CATEGORIES[category];
  if (!preset) return null;
  const localeUpper = locale.toUpperCase() as 'IT' | 'EN' | 'PT';
  return preset.mainDataLabels[localeUpper] || null;
}

/**
 * Ottiene i valori predefiniti per una categoria nella lingua specificata
 */
export function getDefaultValuesForCategory(
  category: string,
  locale: 'it' | 'en' | 'pt' = 'it'
): string[] | null {
  const preset = PRESET_CATEGORIES[category];
  if (!preset?.defaultValues) return null;
  const localeUpper = locale.toUpperCase() as 'IT' | 'EN' | 'PT';
  return preset.defaultValues[localeUpper] || null;
}

/**
 * Ottiene il locale del progetto corrente
 */
export function getCurrentProjectLocale(): 'it' | 'en' | 'pt' {
  try {
    return (localStorage.getItem('project.lang') || 'it') as 'it' | 'en' | 'pt';
  } catch {
    return 'it';
  }
}

/**
 * Ottiene la label di una categoria nella lingua corrente
 */
export function getCategoryLabel(category: string, locale?: 'it' | 'en' | 'pt'): string | null {
  const preset = PRESET_CATEGORIES[category];
  if (!preset) return null;
  const currentLocale = locale || getCurrentProjectLocale();
  const localeUpper = currentLocale.toUpperCase() as 'IT' | 'EN' | 'PT';
  return preset.labels[localeUpper] || null;
}
