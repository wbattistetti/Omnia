import React, { lazy } from 'react';
import type { EditorKind, EditorProps } from './types';
import DDTEditor from '../ResponseEditor/DDTHostAdapter';
import IntentEditor from '../../../features/intent-editor/HostAdapter';

type LazyComp = React.LazyExoticComponent<React.ComponentType<EditorProps>>;
type DirectComp = React.ComponentType<EditorProps>;

// DDTEditor e IntentEditor sono molto usati, quindi li importiamo direttamente invece di lazy loading
const TextMessageEditor = lazy(() => import('./editors/TextMessageEditor')) as unknown as LazyComp;
const BackendCallEditor = lazy(() => import('./editors/BackendCallEditor')) as unknown as LazyComp;

export const registry: Record<EditorKind, LazyComp | DirectComp> = {
  message: TextMessageEditor,
  ddt: DDTEditor, // Import diretto per evitare lazy loading delay
  intent: IntentEditor, // Import diretto per aprire istantaneamente l'editor ProblemClassification
  backend: BackendCallEditor,
};


