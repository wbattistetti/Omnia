/**
 * Editor font family and scale (persisted via zustand `useFontStore`).
 */

import { useFontStore, type FontSize, type FontType } from '../../state/fontStore';

const FONT_TYPES: { value: FontType; label: string }[] = [
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' },
];

const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: 'xs', label: 'XS' },
  { value: 'sm', label: 'SM' },
  { value: 'base', label: 'Base' },
  { value: 'md', label: 'MD' },
  { value: 'lg', label: 'LG' },
];

export function EditorFontPanel() {
  const { fontType, fontSize, setFontType, setFontSize } = useFontStore();

  return (
    <div className="max-w-xl space-y-4 text-slate-100">
      <p className="text-sm text-slate-400">
        Tipografia dell&apos;editor (canvas, sidebar, testi). Si applica all&apos;interfaccia progetto.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs text-slate-500">Font</span>
          <select
            value={fontType}
            onChange={(e) => setFontType(e.target.value as FontType)}
            className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          >
            {FONT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-slate-500">Size</span>
          <select
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value as FontSize)}
            className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          >
            {FONT_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
