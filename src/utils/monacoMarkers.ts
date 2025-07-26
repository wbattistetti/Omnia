// src/utils/monacoMarkers.ts
import * as monaco from 'monaco-editor';

export function setMonacoMarkers(
  editor: monaco.editor.IStandaloneCodeEditor,
  monacoInstance: typeof monaco,
  markers: monaco.editor.IMarkerData[]
) {
  const model = editor.getModel();
  if (model) {
    monacoInstance.editor.setModelMarkers(model, 'custom', markers);
  }
} 