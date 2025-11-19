export type ExecMode = 'predicate' | 'value' | 'object' | 'enum';
export type Sensitivity = 'public' | 'pii' | 'secret';

export interface ContextVar {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'json';
  description: string;
  value?: unknown;
  sensitivity: Sensitivity;
  scope?: 'file' | 'project' | 'session';
}

export type Authorization = Record<string, 'allow' | 'deny' | 'ask'>;

export interface ExecutionSpec {
  mode: ExecMode;
  code: string;
  outputSchema?: any;
}

export type Assertion =
  | { kind: 'equals'; expected: any }
  | { kind: 'approx'; expected: number; tol: number }
  | { kind: 'matches'; regex: string }
  | { kind: 'jsonPathEquals'; path: string; expected: any }
  | { kind: 'oneOf'; options: any[] };

export interface TestCase {
  id: string;
  name: string;
  values: Record<string, unknown>;
  assertions?: Assertion[]; // Optional: for predicate mode, use expectedBoolean instead
  expectedBoolean?: boolean; // For predicate mode: expected true/false result
  hint?: string; // AI-generated hint for this test case
  pinned?: boolean;
  note?: string;
}

export interface TestSuite {
  id: string;
  name: string;
  defaults: Record<string, unknown>;
  cases: TestCase[];
  codeHash: string;
  schemaHash?: string;
}

export interface CompletionReq {
  code: string;
  cursor: { line: number; column: number };
  variables: {
    metadata: Array<Pick<ContextVar, 'key' | 'type' | 'description' | 'sensitivity'>>;
    values: Record<string, unknown>;
  };
  mode: ExecMode;
}
export interface CompletionResp {
  items: Array<{ text: string; range?: { startLine: number; startCol: number; endLine: number; endCol: number } }>;
}

export interface EditToPatchReq {
  instructions: string;
  execution: { mode: ExecMode; code: string };
  variables: {
    metadata: Array<Pick<ContextVar, 'key' | 'type' | 'description' | 'sensitivity'>>;
    values: Record<string, unknown>;
  };
}
export type UnifiedDiff = string;

export interface RunTestsReq {
  code: string;
  mode: ExecMode;
  suite: TestSuite;
  auth: Authorization;
}
export interface RunTestsResp {
  pass: number; fail: number; blocked: number; ms: number;
  results: Array<{ caseId: string; ok: boolean; error?: string; output?: unknown }>
}

export interface SuggestedCases {
  trueCase?: Record<string, unknown>;
  falseCase?: Record<string, unknown>;
  hintTrue?: string;
  hintFalse?: string;
}

export interface CodeEditorProps {
  initialCode?: string;
  initialMode?: ExecMode;
  initialVars?: ContextVar[];
  initialSuite?: TestSuite;
  layout?: 'full' | 'compact';
  fontPx?: number; // externally controlled font size for all editor surfaces
  ai: {
    codeCompletion?: (req: CompletionReq) => Promise<CompletionResp>;
    codeEditToPatch: (req: EditToPatchReq) => Promise<UnifiedDiff>;
    suggestTestCases?: (req: { code: string; mode: ExecMode; variables: string[]; nl?: string }) => Promise<SuggestedCases>; // For predicate mode: suggest test cases
  };
  tests: { run: (req: RunTestsReq) => Promise<RunTestsResp> };
  onPatchApplied?: (evt: { code: string; diff: string; chunksApplied: number }) => void;
  onCodeChange?: (code: string) => void;
  onRequestAuth?: (keys: string[]) => Promise<Authorization>;
  onSave?: (code: string) => Promise<void>;
  // Generate button customization
  showGenerateButton?: boolean; // Show "Create code" button (default: false for compact, true for full)
  generateButtonLabel?: string; // Custom label (default: "Generate")
  onGenerateClick?: () => void; // Custom generate handler (if not provided, uses ai.codeEditToPatch)
  // Test cases callback
  onTestCasesSuggested?: (cases: TestCase[]) => void; // Called when AI suggests test cases
}



