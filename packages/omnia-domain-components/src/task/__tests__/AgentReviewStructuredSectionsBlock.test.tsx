/**
 * Tests for shared structured sections review block.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  AgentReviewStructuredSectionsBlock,
  hasReviewStructuredSectionContent,
} from '../AgentReviewStructuredSectionsBlock';

describe('hasReviewStructuredSectionContent', () => {
  it('returns false when all sections empty', () => {
    expect(hasReviewStructuredSectionContent({})).toBe(false);
    expect(hasReviewStructuredSectionContent({ goal: '  ' })).toBe(false);
  });

  it('returns true when any section has text', () => {
    expect(hasReviewStructuredSectionContent({ goal: 'Scopo agente' })).toBe(true);
  });
});

describe('AgentReviewStructuredSectionsBlock', () => {
  it('renders nothing when no section content', () => {
    const { container } = render(<AgentReviewStructuredSectionsBlock sections={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders tabs and section text when content exists', () => {
    render(
      <AgentReviewStructuredSectionsBlock
        sections={{ goal: 'Aiutare il cliente', context: 'Telefono inbound' }}
        readOnly
      />
    );
    expect(screen.getByText(/Design strutturato/i)).toBeInTheDocument();
    expect(screen.getByText('Aiutare il cliente')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Contesto' })).toBeInTheDocument();
  });
});
