import React from 'react';
import { BookOpen } from 'lucide-react';

interface LibraryLabelProps {
  onOpen: () => void;
}

/**
 * Label verticale "Library" sul bordo sinistro dello schermo
 * Semi-trasparente, aumenta opacità su hover
 */
export default function LibraryLabel({ onOpen }: LibraryLabelProps) {
  return (
    <button
      onClick={onOpen}
      className="fixed left-0 top-1/2 -translate-y-1/2 z-50
                 bg-slate-800/40 hover:bg-slate-800/70
                 border-r-2 border-slate-600/50 hover:border-slate-500/70
                 px-2 py-8 rounded-r-lg
                 transition-all duration-300 ease-in-out
                 cursor-pointer group
                 backdrop-blur-sm
                 shadow-lg hover:shadow-xl"
      title="Apri Library"
      aria-label="Apri Library"
    >
      <div className="flex flex-col items-center gap-2">
        <BookOpen className="w-5 h-5 text-slate-300/70 group-hover:text-slate-200 transition-colors" />
        <span
          className="text-slate-300/70 group-hover:text-slate-200
                     font-semibold text-sm tracking-wider
                     transition-colors duration-300"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          Library
        </span>
      </div>
    </button>
  );
}

