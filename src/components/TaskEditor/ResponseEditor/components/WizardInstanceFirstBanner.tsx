/**
 * Dev banner when WIZARD_INSTANCE_FIRST is on: completing the wizard keeps the row as a project instance.
 */

import React from 'react';
import { isWizardInstanceFirstEnabled } from '../../../../config/featureFlags';

export function WizardInstanceFirstBanner() {
  if (!isWizardInstanceFirstEnabled()) {
    return null;
  }

  return (
    <div
      role="status"
      data-testid="wizard-instance-first-banner"
      style={{
        padding: '8px 12px',
        background: '#fef3c7',
        color: '#78350f',
        fontSize: 13,
        borderBottom: '1px solid #fcd34d',
      }}
    >
      <strong>Wizard → progetto (beta):</strong> completando il wizard la riga resta un&apos;istanza nel{' '}
      <strong>progetto</strong> corrente (albero e step locali) e il legame al template di progetto viene rimosso. In
      sviluppo è attivo di default; imposta{' '}
      <code style={{ fontSize: 12 }}>localStorage featureFlag_WIZARD_INSTANCE_FIRST</code> a <code style={{ fontSize: 12 }}>false</code> e ricarica per disattivare.
    </div>
  );
}
