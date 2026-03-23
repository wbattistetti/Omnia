/**
 * Dockview default tab without close — AI Agent editor panels are mandatory and must stay open.
 */

import React from 'react';
import { DockviewDefaultTab, type IDockviewDefaultTabProps } from 'dockview';

export function AIAgentNonClosableDockTab(props: IDockviewDefaultTabProps) {
  return <DockviewDefaultTab {...props} hideClose />;
}
