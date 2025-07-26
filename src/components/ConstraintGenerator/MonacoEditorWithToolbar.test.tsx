import React from 'react';
import { render } from '@testing-library/react';
import MonacoEditorWithToolbar from './MonacoEditorWithToolbar';

describe('MonacoEditorWithToolbar', () => {
  const scripts = {
    js: 'console.log(1);',
    py: 'print(1)',
    ts: 'console.log<number>(1);'
  };

  it('mostra il summary se presente', () => {
    const { getByText } = render(
      <MonacoEditorWithToolbar
        scriptsByLanguage={scripts}
        summary="Sommario di test"
        currentLanguage="js"
        onLanguageChange={() => {}}
        showComments={true}
        onToggleComments={() => {}}
        onAIClick={() => {}}
        panelHeight={320}
        onPanelHeightChange={() => {}}
      />
    );
    expect(getByText('Sommario di test')).toBeInTheDocument();
  });

  it('mostra il codice per il linguaggio selezionato', () => {
    const { getByText, rerender } = render(
      <MonacoEditorWithToolbar
        scriptsByLanguage={scripts}
        summary=""
        currentLanguage="js"
        onLanguageChange={() => {}}
        showComments={true}
        onToggleComments={() => {}}
        onAIClick={() => {}}
        panelHeight={320}
        onPanelHeightChange={() => {}}
      />
    );
    expect(getByText(/console\.log/)).toBeInTheDocument();
    rerender(
      <MonacoEditorWithToolbar
        scriptsByLanguage={scripts}
        summary=""
        currentLanguage="py"
        onLanguageChange={() => {}}
        showComments={true}
        onToggleComments={() => {}}
        onAIClick={() => {}}
        panelHeight={320}
        onPanelHeightChange={() => {}}
      />
    );
    expect(getByText(/print/)).toBeInTheDocument();
  });
}); 