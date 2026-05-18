/**
 * Pills showing data types detected by the first KB classify pass.
 */

import React from 'react';

export type KbDataTypePillsProps = {
  dataTypes: readonly string[];
  className?: string;
};

export function KbDataTypePills({
  dataTypes,
  className = '',
}: KbDataTypePillsProps): React.ReactElement {
  if (dataTypes.length === 0) {
    return (
      <p className={'text-slate-500 ' + className}>
        Esegui Analyze per l&apos;analisi semantica e i focus di approfondimento.
      </p>
    );
  }

  return (
    <div className={'flex flex-wrap gap-1.5 ' + className}>
      {dataTypes.map((label) => (
        <span
          key={label}
          className="rounded-full border border-violet-600/50 bg-violet-950/70 px-2.5 py-0.5 font-medium text-violet-100"
        >
          {label}
        </span>
      ))}
    </div>
  );
}
