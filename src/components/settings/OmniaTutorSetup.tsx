/**
 * Designer-only Omnia Tutor LLM settings — wrapper su {@link DesignerLlmSetupPanel}.
 */

import React from 'react';
import { DesignerLlmSetupPanel } from '@components/settings/designerLlm/DesignerLlmSetupPanel';

export function OmniaTutorSetup(): React.ReactElement {
  return <DesignerLlmSetupPanel showMissingModelBannerFromGuard />;
}
