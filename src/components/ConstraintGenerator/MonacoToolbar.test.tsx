import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import MonacoToolbar from './MonacoToolbar';

describe('MonacoToolbar', () => {
  it('mostra le tab dei linguaggi e chiama onLanguageChange', () => {
    const handleLang = jest.fn();
    const { getAllByRole } = render(
      <MonacoToolbar
        currentLanguage="js"
        onLanguageChange={handleLang}
        showComments={true}
        onToggleComments={() => {}}
        onAIClick={() => {}}
      />
    );
    const buttons = getAllByRole('button');
    // Clicca la tab Python
    fireEvent.click(buttons.find(btn => btn.title === 'Python'));
    expect(handleLang).toHaveBeenCalled();
  });

  it('mostra l\'occhio e chiama onToggleComments', () => {
    const handleToggle = jest.fn();
    const { getAllByTitle } = render(
      <MonacoToolbar
        currentLanguage="js"
        onLanguageChange={() => {}}
        showComments={true}
        onToggleComments={handleToggle}
        onAIClick={() => {}}
      />
    );
    fireEvent.click(getAllByTitle('Mostra o nascondi i commenti nello script')[0]);
    expect(handleToggle).toHaveBeenCalled();
  });

  it('chiama onAIClick quando si clicca il pulsante AI', () => {
    const handleAI = jest.fn();
    const { getByText } = render(
      <MonacoToolbar
        currentLanguage="js"
        onLanguageChange={() => {}}
        showComments={true}
        onToggleComments={() => {}}
        onAIClick={handleAI}
      />
    );
    fireEvent.click(getByText(/AI/i));
    expect(handleAI).toHaveBeenCalled();
  });
}); 