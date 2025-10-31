import React, { lazy } from 'react';
import type { EditorKind, EditorProps } from './types';
import DDTEditor from '../ResponseEditor/DDTHostAdapter';

type LazyComp = React.LazyExoticComponent<React.ComponentType<EditorProps>>;
type DirectComp = React.ComponentType<EditorProps>;

// DDTEditor è molto usato, quindi lo importiamo direttamente invece di lazy loading
const IntentEditor = lazy(() => import('../../../features/intent-editor/HostAdapter')) as unknown as LazyComp;
const TextMessageEditor = lazy(() => import('./editors/TextMessageEditor')) as unknown as LazyComp;
const BackendCallEditor = lazy(() => import('./editors/BackendCallEditor')) as unknown as LazyComp;

export const registry: Record<EditorKind, LazyComp | DirectComp> = {
  message: TextMessageEditor,
  ddt: DDTEditor, // Import diretto per evitare lazy loading delay
  intent: IntentEditor,
  backend: BackendCallEditor,
};


