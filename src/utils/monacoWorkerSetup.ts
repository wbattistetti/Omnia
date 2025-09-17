// Monaco worker setup for Vite/ESM
// Loads language workers explicitly to avoid "getWorkerUrl" errors
// and the fallback to main thread that freezes UI
// Ref: https://github.com/microsoft/monaco-editor#using-amd-loader

// eslint-disable-next-line import/no-unresolved
// The `?worker` query is handled by Vite to create a web worker bundle
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';

let initialized = false;

export function setupMonacoEnvironment(): void {
  if (initialized) return;
  initialized = true;
  try {
    (self as any).MonacoEnvironment = {
      getWorker(_: unknown, label: string) {
        if (label === 'typescript' || label === 'javascript') return new (tsWorker as any)();
        if (label === 'json') return new (jsonWorker as any)();
        if (label === 'css' || label === 'scss' || label === 'less') return new (cssWorker as any)();
        if (label === 'html' || label === 'handlebars' || label === 'razor') return new (htmlWorker as any)();
        return new (editorWorker as any)();
      },
    };
    // eslint-disable-next-line no-console
    console.log('[Monaco][workers] Environment configured');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Monaco][workers] Failed to setup environment', e);
  }
}




