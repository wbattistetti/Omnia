import React from 'react';

/**
 * Dropdown for the "+" control: Before / After / Child (no "Add" prefix).
 */
export function UseCaseTreeContextMenu(props: {
  onBefore: () => void;
  onAfter: () => void;
  onChild: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const { onBefore, onAfter, onChild, onMouseEnter, onMouseLeave } = props;
  return (
    <div
      className="absolute left-0 top-full z-20 mt-0.5 min-w-[7rem] rounded border border-slate-700 bg-slate-900 p-1 shadow-lg"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        type="button"
        onClick={onBefore}
        className="block w-full text-left text-xs px-2 py-1 hover:bg-slate-800 text-amber-100/95"
      >
        Before
      </button>
      <button
        type="button"
        onClick={onAfter}
        className="block w-full text-left text-xs px-2 py-1 hover:bg-slate-800 text-amber-100/95"
      >
        After
      </button>
      <button
        type="button"
        onClick={onChild}
        className="block w-full text-left text-xs px-2 py-1 hover:bg-slate-800 text-amber-100/95"
      >
        Child
      </button>
    </div>
  );
}
