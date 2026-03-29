/**
 * Visible when wizard instance-first is enabled (default on in dev; overridable via localStorage).
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
      <strong>Wizard instance-first (beta):</strong> finishing the wizard saves this row as{' '}
      <strong>standalone</strong> (local tree + steps) and clears the project template link. In dev this is on by
      default; set <code style={{ fontSize: 12 }}>localStorage featureFlag_WIZARD_INSTANCE_FIRST</code> to{' '}
      <code style={{ fontSize: 12 }}>false</code> and reload to turn off.
    </div>
  );
}
