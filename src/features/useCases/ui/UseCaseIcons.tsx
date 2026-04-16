import React from 'react';
import { MessageCircle, Save } from 'lucide-react';

/**
 * Centralized icons used across Use Cases UI entry points.
 */
export function UseCasesPanelIcon(props: { size?: number; className?: string }) {
  const { size = 16, className } = props;
  return <MessageCircle size={size} className={className} aria-hidden />;
}

/**
 * Composite save icon: use-cases panel icon with save overlay.
 */
export function UseCasesSaveIcon(props: { size?: number; className?: string }) {
  const { size = 16, className } = props;
  const overlaySize = Math.max(8, Math.floor(size * 0.56));
  return (
    <span className={`relative inline-flex items-center justify-center ${className || ''}`} aria-hidden>
      <UseCasesPanelIcon size={size} />
      <Save size={overlaySize} className="absolute bottom-0 right-0" strokeWidth={2.5} />
    </span>
  );
}

