import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ResponseEditorCore from '../ResponseEditorCore';

// Mock dei dati di test
const mockDDT = {
  id: 'test-ddt',
  mainData: {
    steps: {
      start: [
        {
          id: 'action1',
          type: 'sayMessage',
          message: 'key1'
        }
      ],
      noMatch: [
        {
          id: 'esc1',
          type: 'escalation',
          label: 'recovery'
        }
      ]
    }
  }
};

const mockTranslations = {
  it: {
    key1: 'Ho capito!'
  }
};

describe('ResponseEditorCore', () => {
  it('should render without crashing', () => {
    render(
      <ResponseEditorCore 
        ddt={mockDDT} 
        translations={mockTranslations} 
        lang="it" 
      />
    );
    
    expect(screen.getByText('🧠 ResponseEditorCore')).toBeInTheDocument();
  });

  it('should show current step', () => {
    render(
      <ResponseEditorCore 
        ddt={mockDDT} 
        translations={mockTranslations} 
        lang="it" 
      />
    );
    
    expect(screen.getByText(/Step corrente:/)).toBeInTheDocument();
    expect(screen.getByText('start')).toBeInTheDocument();
  });

  it('should change step when clicking buttons', () => {
    render(
      <ResponseEditorCore 
        ddt={mockDDT} 
        translations={mockTranslations} 
        lang="it" 
      />
    );
    
    const noMatchButton = screen.getByText('Non capisco');
    fireEvent.click(noMatchButton);
    
    expect(screen.getByText('noMatch')).toBeInTheDocument();
  });
}); 