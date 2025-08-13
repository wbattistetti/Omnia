import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DebugGroupedPanel from '../DebugGroupedPanel';

describe('DebugGroupedPanel', () => {
  it('renders grouped logs', () => {
    render(
      <DebugGroupedPanel
        logs={[
          { ts: Date.now(), kind: 'state', message: 'Mode -> CollectingMain' },
          { ts: Date.now(), kind: 'input', message: '12/05/1990' },
          { ts: Date.now(), kind: 'state', message: 'Mode -> ConfirmingMain' },
        ]}
      />
    );
    expect(screen.getByLabelText('debug-grouped')).toBeTruthy();
  });
});


