import React, { useEffect } from 'react';
import { isValidVersion } from '../../utils/versionUtils';

export type VersionQualifier = 'alpha' | 'beta' | 'rc' | 'production';

const versionQualifiers = [
  { id: 'alpha' as VersionQualifier, name: 'Alpha' },
  { id: 'beta' as VersionQualifier, name: 'Beta' },
  { id: 'rc' as VersionQualifier, name: 'Release Candidate' },
  { id: 'production' as VersionQualifier, name: 'Production' }
];

interface VersionInputProps {
  version: string;
  versionQualifier: VersionQualifier;
  onVersionChange: (version: string) => void;
  onQualifierChange: (qualifier: VersionQualifier) => void;
  disabled?: boolean;
}

const MIN_VERSION_WIDTH_PX = 88;

/** Normalize to digits.digits only; keep exactly one dot (undeletable). */
function normalizeVersionInput(nextRaw: string, currentVersion: string): string {
  const filtered = nextRaw.replace(/[^0-9.]/g, '');
  if (filtered === '') return currentVersion && currentVersion.includes('.') ? currentVersion : '1.0';
  if (!filtered.includes('.')) {
    if (currentVersion.includes('.')) return currentVersion;
    return filtered + '.0';
  }
  const parts = filtered.split('.');
  if (parts.length === 2) return filtered;
  const major = parts[0] || '0';
  const minor = parts.slice(1).join('');
  return `${major}.${minor}`;
}

export function VersionInput({
  version,
  versionQualifier,
  onVersionChange,
  onQualifierChange,
  disabled = false
}: VersionInputProps) {
  const displayVersion = normalizeVersionInput(version || '', '1.0');
  const valid = isValidVersion(displayVersion);

  useEffect(() => {
    if ((version || '') !== displayVersion) onVersionChange(displayVersion);
  }, []);

  const handleVersionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = normalizeVersionInput(e.target.value, displayVersion);
    onVersionChange(next);
  };
  return (
    <div
      className={`flex items-center bg-slate-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-500 ${
        valid ? 'border border-slate-600' : 'border border-red-500'
      }`}
    >
      <input
        type="text"
        inputMode="decimal"
        value={displayVersion}
        onChange={handleVersionChange}
        className="px-3 py-3 bg-transparent text-white focus:outline-none border-0 min-w-0"
        style={{ minWidth: MIN_VERSION_WIDTH_PX, width: `${Math.max(displayVersion.length * 8 + 24, MIN_VERSION_WIDTH_PX)}px` }}
        placeholder="1.0"
        disabled={disabled}
        title={valid ? 'Formato: major.minor (es. 1.0, 2.3). Il punto è obbligatorio.' : 'Formato versione: major.minor (es. 1.0, 2.3)'}
      />
      <div className="w-px h-6 bg-slate-600"></div>
      <select
        value={versionQualifier}
        onChange={(e) => onQualifierChange(e.target.value as VersionQualifier)}
        className="flex-1 px-3 py-3 bg-slate-700 text-white focus:outline-none border-0 cursor-pointer"
        disabled={disabled}
      >
        {versionQualifiers.map((qual) => (
          <option key={qual.id} value={qual.id}>
            {qual.name}
          </option>
        ))}
      </select>
    </div>
  );
}
