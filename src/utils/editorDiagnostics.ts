// Utilities to guarantee Monaco markers even when backend responses are empty or fail.
import { editor as monacoEditor, MarkerSeverity } from 'monaco-editor';
import type { IStandaloneCodeEditor, ITextModel } from 'monaco-editor';

export type LintFinding = {
  severity: 'error' | 'warning' | 'info';
  message: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  rule: string;
};

function activeModel(editor?: IStandaloneCodeEditor | null): ITextModel | null {
  try { if (editor && editor.getModel()) return editor.getModel()!; } catch {}
  try {
    const models = monacoEditor.getModels();
    return models && models.length ? models[0] : null;
  } catch {}
  return null;
}

export function showEditorError(
  owner: 'conditions-runtime' | 'conditions-lint',
  message: string,
  editor?: IStandaloneCodeEditor | null
) {
  const model = activeModel(editor);
  if (!model) return;
  // clear previous for this owner then set a single marker at 1:1
  monacoEditor.setModelMarkers(model, owner, []);
  monacoEditor.setModelMarkers(model, owner, [{
    severity: MarkerSeverity.Error,
    message,
    startLineNumber: 1, startColumn: 1,
    endLineNumber: 1, endColumn: 1,
    source: owner,
  }]);
}

export function clearMarkers(owner: 'conditions-runtime' | 'conditions-lint', editor?: IStandaloneCodeEditor | null) {
  const model = activeModel(editor);
  if (!model) return;
  monacoEditor.setModelMarkers(model, owner, []);
}

export function applyLintMarkers(findings: LintFinding[], editor?: IStandaloneCodeEditor | null) {
  const model = activeModel(editor);
  if (!model) return;
  const markers = (findings || []).map((f) => ({
    severity: f.severity === 'error' ? MarkerSeverity.Error : f.severity === 'warning' ? MarkerSeverity.Warning : MarkerSeverity.Info,
    message: `[${f.rule}] ${f.message}`,
    startLineNumber: f.startLine ?? 1,
    startColumn: f.startCol ?? 1,
    endLineNumber: f.endLine ?? (f.startLine ?? 1),
    endColumn: f.endCol ?? (f.startCol ?? 1),
    source: 'conditions-lint',
  }));
  monacoEditor.setModelMarkers(model, 'conditions-lint', markers);
}

export async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try { return text ? JSON.parse(text) : null; } catch { return { __parseError: text?.slice(0, 400) }; }
}

export async function callLintFrontend(code: string, inputs: string[], editor?: IStandaloneCodeEditor | null) {
  try {
    const res = await fetch('/api/conditions/lint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, inputs }),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      const msg = `Lint failed (${res.status} ${res.statusText})` + (data?.message ? `: ${data.message}` : '');
      showEditorError('conditions-lint', msg, editor);
      return;
    }
    if (!data || (!data.findings && !data.errors)) {
      showEditorError('conditions-lint', 'Lint: backend returned no results.', editor);
      return;
    }
    const findings: LintFinding[] = [
      ...(data.findings ?? []),
      ...((data.errors ?? []).map((e: any) => ({
        severity: 'error' as const,
        message: String(e.message || 'error'),
        startLine: Number(e.startLine ?? 1),
        startCol: Number(e.startCol ?? 1),
        endLine: Number(e.endLine ?? (e.startLine ?? 1)),
        endCol: Number(e.endCol ?? (e.startCol ?? 1)),
        rule: String(e.phase || 'error'),
      }))),
    ];
    applyLintMarkers(findings, editor);
  } catch (e: any) {
    showEditorError('conditions-lint', `Lint: network/JSON error. ${String(e?.message || e)}`, editor);
  }
}

export async function callRepairFrontend(payload: any, editor?: IStandaloneCodeEditor | null): Promise<{ script?: string; error?: string } | null> {
  try {
    const res = await fetch('/api/conditions/repair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      const msg = `Repair failed (${res.status} ${res.statusText})` + (data?.message ? `: ${data.message}` : '');
      showEditorError('conditions-runtime', msg, editor);
      return { error: msg };
    }
    const script = data?.script || data?.code;
    if (!script || typeof script !== 'string') {
      showEditorError('conditions-runtime', 'Repair: backend did not return code.', editor);
      return { error: 'no_code' };
    }
    return { script };
  } catch (e: any) {
    const msg = `Repair: network/JSON error. ${String(e?.message || e)}`;
    showEditorError('conditions-runtime', msg, editor);
    return { error: msg };
  }
}


