import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Layers, CheckSquare, Square, Search } from 'lucide-react';
import { useSidebarState } from './SidebarState';

interface SidebarHeaderProps {
  onToggleCollapse: () => void;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({ onToggleCollapse }) => {
  const { isCollapsed } = useSidebarState();
  const [theme, setTheme] = useState<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  );

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <div className="p-4 border-b border-slate-700 bg-slate-800">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-white">Progetto</h1>
        <button onClick={onToggleCollapse} aria-label="Toggle sidebar">
          {isCollapsed ? <ChevronRight className="w-5 h-5 text-white" /> : <ChevronLeft className="w-5 h-5 text-white" />}
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="p-2 rounded border border-violet-300 bg-violet-100">
          <Layers className="w-7 h-7 text-violet-700" />
        </div>
        <div className="p-2 rounded border border-blue-300 bg-blue-100">
          <CheckSquare className="w-7 h-7 text-blue-700" />
        </div>
        <div className="p-2 rounded border border-gray-300 bg-gray-100">
          <Square className="w-7 h-7 text-gray-700" />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Cerca..."
          className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 text-sm text-black placeholder-gray-400"
        />
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
        <span className="font-bold text-lg">Progetto</span>
        <div className="flex items-center gap-2">
          <button
            className="p-1 text-gray-400 hover:text-blue-400"
            onClick={onToggleCollapse}
            title="Collapse sidebar"
          >
            ≡
          </button>
          <button
            className="p-1 text-yellow-500 hover:text-yellow-700 text-lg"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? 'Passa a tema scuro' : 'Passa a tema chiaro'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SidebarHeader;