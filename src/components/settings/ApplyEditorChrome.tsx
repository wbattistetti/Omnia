/**
 * Syncs persisted accent preset to `document.documentElement` for CSS hooks.
 */

import { useEffect } from 'react';
import { useEditorChromeStore } from '../../state/editorChromeStore';

export function ApplyEditorChrome() {
  const accent = useEditorChromeStore((s) => s.accent);

  useEffect(() => {
    document.documentElement.setAttribute('data-editor-accent', accent);
  }, [accent]);

  return null;
}
