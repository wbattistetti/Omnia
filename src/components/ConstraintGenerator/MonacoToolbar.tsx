import React from 'react';
import { Eye, EyeOff, Bot } from 'lucide-react';
import { LANGUAGES } from './constants';
import jsIcon from './icons/js.svg';
import pythonIcon from './icons/python.svg';
import tsIcon from './icons/ts.svg';

const LANGUAGE_ICONS: Record<string, React.ReactNode> = {
  js: <img src={jsIcon} alt="JS" width={20} height={20} />,
  py: <img src={pythonIcon} alt="Python" width={20} height={20} />,
  ts: <img src={tsIcon} alt="TS" width={20} height={20} />,
};

interface MonacoToolbarProps {
  currentLanguage: string;
  onLanguageChange: (lang: string) => void;
  showComments: boolean;
  onToggleComments: () => void;
  onAIClick: () => void;
}

const MonacoToolbar: React.FC<MonacoToolbarProps> = ({
  currentLanguage,
  onLanguageChange,
  showComments,
  onToggleComments,
  onAIClick
}) => (
  <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #a21caf', padding: '4px 12px', background: '#23232b', borderTopLeftRadius: 0, borderTopRightRadius: 0, fontSize: 14 }}>
    {/* Tabs linguaggi */}
    <div style={{ display: 'flex', gap: 8 }}>
      {LANGUAGES.map(lang => (
        <button
          key={lang.key}
          onClick={() => onLanguageChange(lang.key)}
          title={lang.label}
          style={{
            background: currentLanguage === lang.key ? '#a21caf' : 'transparent',
            color: currentLanguage === lang.key ? '#fff' : '#ccc',
            border: 'none',
            borderRadius: 6,
            padding: '4px 10px',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          {LANGUAGE_ICONS[lang.key]}
        </button>
      ))}
    </div>
    <div style={{ flex: 1 }} />
    {/* Solo occhio con tooltip */}
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginRight: 10 }}>
      <button
        onClick={onToggleComments}
        style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}
        title="Mostra o nascondi i commenti nello script"
      >
        {showComments ? <Eye size={18} /> : <EyeOff size={18} />}
      </button>
    </div>
    {/* AI helper */}
    <button onClick={onAIClick} style={{ background: '#a21caf', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 12px', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      <Bot size={18} /> AI
    </button>
  </div>
);

export default MonacoToolbar; 