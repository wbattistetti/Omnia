// Tipi condivisi per ConstraintGenerator

export type LanguageKey = 'js' | 'py' | 'ts';

export interface ConstraintTestCase {
  input: any; // valore di test (string, number, date, ecc.)
  expected: boolean; // true se deve passare la validazione
  description: string; // breve descrizione del caso
}

export interface AIConstraintTestCase {
  input: any;
  expected: any;
  description: string;
}

export interface Constraint {
  id: string;
  title: string;
  script: string; // espressione JS
  explanation: string; // spiegazione naturale
  messages: string[]; // messaggi di errore/escalation
  testCases: ConstraintTestCase[];
  variable: string; // nome variabile DDT
  type: string; // tipo dato (es: date, number, string)
}

export interface AIScriptResult {
  label: string;
  payoff: string;
  summary: string;
  scripts: {
    js: string;
    py: string;
    ts: string;
  };
  tests: AIConstraintTestCase[];
}

export interface MonacoEditorWithToolbarProps {
  scriptsByLanguage: { [lang in LanguageKey]: string };
  summary: string;
  currentLanguage: LanguageKey;
  onLanguageChange: (lang: LanguageKey) => void;
  showComments: boolean;
  onToggleComments: () => void;
  onAIClick: () => void;
  panelHeight: number;
  onPanelHeightChange: (h: number) => void;
}

export interface ConstraintTestTableProps {
  script: string;
  variable: string;
  type: string;
  testCases: ConstraintTestCase[];
  onChange?: (testCases: ConstraintTestCase[]) => void;
  newRow: ConstraintTestCase;
  onNewRowChange: (field: keyof ConstraintTestCase, value: any) => void;
  onAddRow: () => void;
}

export interface EditableCellProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

// Tipo per LANGUAGES array (solo definizione, non valori con icone)
export interface LanguageDef {
  key: LanguageKey;
  label: string;
  icon: React.ReactNode;
} 