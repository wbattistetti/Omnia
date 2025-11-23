import React from 'react';

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

export function VersionInput({
  version,
  versionQualifier,
  onVersionChange,
  onQualifierChange,
  disabled = false
}: VersionInputProps) {
  return (
    <div className="flex items-center bg-slate-700 border border-slate-600 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-purple-500">
      <input
        type="text"
        value={version}
        onChange={(e) => onVersionChange(e.target.value)}
        className="px-3 py-3 bg-transparent text-white focus:outline-none border-0"
        style={{ width: `${Math.max(version.length * 8 + 16, 40)}px` }}
        placeholder="1.0"
        disabled={disabled}
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
