/**
 * System prompt / instructions textarea.
 */

import { SectionChrome } from './SectionChrome';

export interface PromptSectionProps {
  label: string;
  value: string;
  showOverrideBadge?: boolean;
  onChange: (next: string) => void;
  placeholder?: string;
}

export function PromptSection({
  label,
  value,
  showOverrideBadge,
  onChange,
  placeholder = 'System prompt / instructions…',
}: PromptSectionProps) {
  return (
    <SectionChrome title={label} showOverride={showOverrideBadge}>
      <textarea
        className="min-h-[160px] w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        spellCheck
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </SectionChrome>
  );
}
