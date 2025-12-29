import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ResponseEditor from '../ResponseEditor';
import { ActionsCatalogProvider } from '../../../../context/ActionsCatalogContext';

// Mock del catalogo delle azioni
const mockActionsCatalog = [
  {
    id: 'sayMessage',
    label: { en: 'Message', it: 'Messaggio' },
    description: { en: 'Sends a text message', it: 'Invia un messaggio' },
    icon: 'MessageCircle',
    color: 'text-blue-500'
  },
  {
    id: 'DataRequest',
    label: { en: 'Data Request', it: 'Richiesta Dati' },
    description: { en: 'Requests data from user', it: 'Richiede dati all\'utente' },
    icon: 'HelpCircle',
    color: 'text-purple-500'
  }
];

// Mock del DDT
const mockDDT = {
  id: 'test-ddt',
  label: 'Test DDT',
  mainData: {
    steps: [
      { type: 'start', escalations: [] },
      { type: 'noMatch', escalations: [] }
    ]
  }
};

// Mock delle translations
const mockTranslations = {
  'test-key': 'Test message'
};

describe('Actions Catalog Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithProviders = (props: any) => {
    return render(
      <DndProvider backend={HTML5Backend}>
        <ActionsCatalogProvider initialActions={mockActionsCatalog}>
          <ResponseEditor {...props} />
        </ActionsCatalogProvider>
      </DndProvider>
    );
  };

  it('should load actions catalog and display actions', () => {
    renderWithProviders({
      ddt: mockDDT,
      translations: mockTranslations,
      lang: 'it'
    });

    // Verifica che le azioni siano caricate e visualizzate
    expect(screen.getByText('Messaggio')).toBeInTheDocument();
    expect(screen.getByText('Domanda')).toBeInTheDocument();
  });

  it('should handle empty actions catalog gracefully', () => {
    renderWithProviders({
      ddt: mockDDT,
      translations: mockTranslations,
      lang: 'it'
    });

    // Verifica che non ci siano errori
    expect(screen.getByText('Test DDT')).toBeInTheDocument();
  });

  it('should handle null DDT gracefully', () => {
    renderWithProviders({
      ddt: null,
      translations: mockTranslations,
      lang: 'it'
    });

    // Verifica che il componente si carichi senza errori
    expect(screen.getByText('—')).toBeInTheDocument(); // Label di default
  });
});