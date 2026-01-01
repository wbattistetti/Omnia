import React, { lazy } from 'react';
import type { EditorKind, EditorProps } from './types';
import DDTEditor from '../ResponseEditor/DDTHostAdapter';
import IntentEditor from '../../../features/intent-editor/HostAdapter';
import TextMessageEditor from './editors/TextMessageEditor';
import BackendCallEditor from './editors/BackendCallEditor';

type LazyComp = React.LazyExoticComponent<React.ComponentType<EditorProps>>;
type DirectComp = React.ComponentType<EditorProps>;

// ✅ BackendCallEditor ora importato direttamente per aprire istantaneamente (come DDTEditor, IntentEditor, TextMessageEditor)

export const registry: Record<EditorKind, LazyComp | DirectComp> = {
  message: TextMessageEditor, // Import diretto per aprire istantaneamente l'editor Message
  ddt: DDTEditor, // Import diretto per evitare lazy loading delay
  intent: IntentEditor, // Import diretto per aprire istantaneamente l'editor ProblemClassification
  backend: BackendCallEditor, // ✅ Import diretto per aprire istantaneamente l'editor BackendCall
};


