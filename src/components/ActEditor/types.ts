// Executive summary: TypeScript interfaces and types for the Actions Editor components.
import React from 'react';

export interface ActionItemProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  description?: string;
} 