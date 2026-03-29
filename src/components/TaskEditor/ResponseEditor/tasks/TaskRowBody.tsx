/**
 * Generic container for N parameter editors (or any row body content).
 */

import React from 'react';
import styles from '../TaskRow.module.css';

export type TaskRowBodyProps = {
  children: React.ReactNode;
};

export function TaskRowBody({ children }: TaskRowBodyProps) {
  return (
    <div className={styles.body} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {children}
    </div>
  );
}
