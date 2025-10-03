// src/utils/monacoMarkers.ts
import * as monaco from 'monaco-editor';

export function setMonacoMarkers(
  editor: monaco.editor.IStandaloneCodeEditor,
  monacoInstance: typeof monaco,
  markers: monaco.editor.IMarkerData[],
  owner: string = 'custom'
) {
  const model = editor.getModel();
  if (model) {
    monacoInstance.editor.setModelMarkers(model, owner, markers);
  }
} 

export function clearMonacoMarkers(
  editor: monaco.editor.IStandaloneCodeEditor,
  monacoInstance: typeof monaco,
  owner: string
) {
  const model = editor.getModel();
  if (model) {
    monacoInstance.editor.setModelMarkers(model, owner, []);
  }
}