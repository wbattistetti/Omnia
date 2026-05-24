/**
 * Icona mascotte Omnia (robottino) per header Active Tutor e chip compatti.
 */

import React from 'react';
import { OMNIA_ROBOT_MASCOT_3D } from '../useCaseGeneratorWizard/useCaseMascotAssets';

export interface TutorRobotIconProps {
  readonly size?: number;
  readonly className?: string;
}

export function TutorRobotIcon({
  size = 20,
  className = '',
}: TutorRobotIconProps): React.ReactElement {
  return (
    <img
      src={OMNIA_ROBOT_MASCOT_3D}
      alt=""
      width={size}
      height={size}
      decoding="async"
      aria-hidden
      className={`shrink-0 object-contain ${className}`.trim()}
      style={{ width: size, height: size }}
    />
  );
}
