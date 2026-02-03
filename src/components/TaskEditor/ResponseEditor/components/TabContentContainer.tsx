/**
 * TabContentContainer
 *
 * Centralized container component that guarantees the correct layout contract
 * for all tab content in ResponseEditor.
 *
 * This component ensures:
 * - Content fills available vertical space (flex: 1)
 * - Content can scroll internally (overflow: hidden on container, overflow: auto on children)
 * - Body never scrolls (overflow: hidden prevents body scroll)
 * - No vertical collapse (minHeight: 0 in flex context)
 * - Consistent flex layout (display: flex, flexDirection: column)
 *
 * Usage:
 *   <TabContentContainer>
 *     <YourTabContent />
 *   </TabContentContainer>
 */

import React from 'react';

export interface TabContentContainerProps {
  children: React.ReactNode;
  /**
   * Optional padding. Default: '0'.
   * Use this instead of adding padding to child components.
   */
  padding?: string | number;
  /**
   * Optional overflow behavior. Default: 'hidden'.
   * Use 'auto' if the container itself should scroll (rare).
   * Use 'hidden' if children should scroll (common).
   */
  overflow?: 'hidden' | 'auto';
  /**
   * Optional className for styling.
   */
  className?: string;
  /**
   * Optional inline styles to merge with default styles.
   */
  style?: React.CSSProperties;
}

/**
 * Container that guarantees correct layout contract for tab content.
 *
 * Contract:
 * - display: 'flex'
 * - flexDirection: 'column'
 * - flex: 1
 * - minHeight: 0
 * - overflow: 'hidden' (or 'auto' if specified)
 * - height: '100%' (ensures full height in flex context)
 */
export function TabContentContainer({
  children,
  padding = '0',
  overflow = 'hidden',
  className,
  style,
}: TabContentContainerProps) {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    height: '100%',
    overflow,
    padding,
    ...style,
  };

  return (
    <div className={className} style={containerStyle}>
      {children}
    </div>
  );
}
