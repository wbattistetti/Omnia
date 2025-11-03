import React, { useState } from 'react';
import { useFontStore } from '../../state/fontStore';
import { Type, ChevronDown } from 'lucide-react';

export function FontControls() {
  const { fontType, fontSize, setFontType, setFontSize } = useFontStore();
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);

  const fontTypes: { value: 'sans' | 'serif' | 'mono'; label: string }[] = [
    { value: 'sans', label: 'Sans' },
    { value: 'serif', label: 'Serif' },
    { value: 'mono', label: 'Mono' },
  ];

  const fontSizes: { value: 'xs' | 'sm' | 'base' | 'md' | 'lg'; label: string; px: string }[] = [
    { value: 'xs', label: 'XS', px: '10px' },
    { value: 'sm', label: 'SM', px: '12px' },
    { value: 'base', label: 'Base', px: '14px' },
    { value: 'md', label: 'MD', px: '16px' },
    { value: 'lg', label: 'LG', px: '18px' },
  ];

  return (
    <div className="flex items-center gap-2">
      {/* Font Type */}
      <div className="relative">
        <button
          onClick={() => {
            setShowTypeMenu(!showTypeMenu);
            setShowSizeMenu(false);
          }}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-600 bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          title="Font Type"
        >
          <Type size={14} />
          <span>{fontTypes.find(t => t.value === fontType)?.label}</span>
          <ChevronDown size={12} />
        </button>
        {showTypeMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowTypeMenu(false)} />
            <div className="absolute right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-20 min-w-[100px]">
              {fontTypes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => {
                    setFontType(t.value);
                    setShowTypeMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg ${
                    fontType === t.value ? 'bg-slate-700 font-semibold' : ''
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Font Size */}
      <div className="relative">
        <button
          onClick={() => {
            setShowSizeMenu(!showSizeMenu);
            setShowTypeMenu(false);
          }}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-slate-600 bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          title="Font Size"
        >
          <span>{fontSizes.find(s => s.value === fontSize)?.label}</span>
          <ChevronDown size={12} />
        </button>
        {showSizeMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowSizeMenu(false)} />
            <div className="absolute right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-20 min-w-[120px]">
              {fontSizes.map((s) => (
                <button
                  key={s.value}
                  onClick={() => {
                    setFontSize(s.value);
                    setShowSizeMenu(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg flex items-center justify-between ${
                    fontSize === s.value ? 'bg-slate-700 font-semibold' : ''
                  }`}
                >
                  <span>{s.label}</span>
                  <span className="text-slate-400 text-[10px]">{s.px}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

