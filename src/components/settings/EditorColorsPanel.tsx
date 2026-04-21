/**
 * Accent palette for editor chrome (sidebar/settings highlights).
 */

import { useEditorChromeStore, type EditorAccentPreset } from '../../state/editorChromeStore';

const PRESETS: Array<{
  id: EditorAccentPreset;
  label: string;
  sample: string;
}> = [
  { id: 'amber', label: 'Ambra', sample: 'bg-amber-500' },
  { id: 'cyan', label: 'Ciano', sample: 'bg-cyan-500' },
  { id: 'violet', label: 'Viola', sample: 'bg-violet-500' },
  { id: 'emerald', label: 'Smeraldo', sample: 'bg-emerald-500' },
];

export function EditorColorsPanel() {
  const accent = useEditorChromeStore((s) => s.accent);
  const setAccent = useEditorChromeStore((s) => s.setAccent);

  return (
    <div className="max-w-xl space-y-4 text-slate-100">
      <p className="text-sm text-slate-400">
        Accento UI per evidenziare controlli e bordi (salvato in questo browser).
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setAccent(p.id)}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              accent === p.id
                ? 'border-violet-400 bg-slate-800 text-white ring-1 ring-violet-500/50'
                : 'border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-500'
            }`}
          >
            <span className={`mb-2 block h-2 w-full rounded ${p.sample}`} aria-hidden />
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
