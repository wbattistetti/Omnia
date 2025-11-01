import React from 'react';
import { Wand2 } from 'lucide-react';
import EditorPanel, { type CustomLanguage } from '../../../CodeEditor/EditorPanel';

interface RegexInlineEditorProps {
  regex: string;
  setRegex: (value: string) => void;
  onClose: () => void;
  node?: any; // Optional: node with subData for AI regex generation
  kind?: string; // Optional: kind for AI regex generation
}

/**
 * Inline editor for configuring regex patterns
 * Supports AI-powered regex generation
 */
export default function RegexInlineEditor({
  regex,
  setRegex,
  onClose,
  node,
  kind,
}: RegexInlineEditorProps) {
  const [regexAiMode, setRegexAiMode] = React.useState(false);
  const [regexAiPrompt, setRegexAiPrompt] = React.useState('');
  const [regexBackup, setRegexBackup] = React.useState('');
  const [generatingRegex, setGeneratingRegex] = React.useState(false);

  // Custom language configuration for regex
  const regexCustomLanguage: CustomLanguage = React.useMemo(() => ({
    id: 'regex',
    tokenizer: {
      root: [
        [/\(\?[:=!]/, 'regex.group.special'],
        [/\(/, 'regex.group'],
        [/\)/, 'regex.group'],
        [/\[\^?/, 'regex.charclass'],
        [/\]/, 'regex.charclass'],
        [/\\[dDsSwW]/, 'regex.escape'],
        [/\\./, 'regex.escape'],
        [/[\*\+\?\|]/, 'regex.quantifier'],
        [/[\^\$]/, 'regex.anchor'],
        [/\{\d+(,\d*)?\}/, 'regex.quantifier'],
        [/[^\\\[\]\(\)\*\+\?\|\^\$\{\}]+/, 'regex.text']
      ]
    },
    theme: {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'regex.group', foreground: 'FFD700' },
        { token: 'regex.group.special', foreground: 'FFA500' },
        { token: 'regex.charclass', foreground: 'ADFF2F' },
        { token: 'regex.escape', foreground: 'FF69B4' },
        { token: 'regex.quantifier', foreground: '00FFFF' },
        { token: 'regex.anchor', foreground: 'FF4500' },
        { token: 'regex.text', foreground: 'FFFFFF' }
      ],
      colors: {
        'editor.background': '#1e1e1e'
      }
    },
    themeName: 'regexTheme'
  }), []);

  // Handle ESC key to exit AI mode
  React.useEffect(() => {
    if (!regexAiMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && regexAiMode) {
        setRegexAiMode(false);
        setRegex(regexBackup);
        e.preventDefault();
        console.log('[AI Regex] Cancelled via ESC - restored:', regexBackup);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [regexAiMode, regexBackup]);

  const handleGenerateWithAI = async () => {
    if (!regexAiPrompt.trim()) return;

    setGeneratingRegex(true);
    try {
      console.log('[AI Regex] Generating regex for:', regexAiPrompt);

      // Extract sub-data from node if available
      const subData = (node?.subData || node?.subSlots || []) as any[];
      const subDataInfo = subData.map((sub: any, index: number) => ({
        id: sub.id || `sub-${index}`,
        label: sub.label || sub.name || '',
        index: index + 1 // Position in capture groups (1, 2, 3...)
      }));

      const response = await fetch('/api/nlp/generate-regex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: regexAiPrompt,
          subData: subDataInfo.length > 0 ? subDataInfo : undefined,
          kind: kind || undefined
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to generate regex');
      }

      const data = await response.json();
      console.log('[AI Regex] Response:', data);

      if (data.success && data.regex) {
        setRegex(data.regex);
        console.log('[AI Regex] Regex generated successfully:', data.regex);

        if (data.explanation) {
          console.log('[AI Regex] Explanation:', data.explanation);
          console.log('[AI Regex] Examples:', data.examples);
        }

        setRegexAiMode(false);
      } else {
        throw new Error('No regex returned from API');
      }
    } catch (error) {
      console.error('[AI Regex] Error:', error);
      alert(
        `Error generating regex: ${error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    } finally {
      setGeneratingRegex(false);
    }
  };

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        background: '#f9fafb',
        animation: 'fadeIn 0.2s ease-in',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          🪄 Configure Regex
        </h3>
        <button
          onClick={onClose}
          style={{
            background: '#e5e7eb',
            border: 'none',
            borderRadius: 4,
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          ❌ Close
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ fontSize: 12, opacity: 0.8 }}>Regex Pattern</label>
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: 1, position: 'relative' }}>
            <div
              style={{
                height: 500,
                border: regexAiMode ? '2px solid #3b82f6' : '1px solid #334155',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <EditorPanel
                code={
                  generatingRegex
                    ? '⏳ Creating regex...'
                    : regexAiMode
                      ? regexAiPrompt
                      : regex
                }
                onChange={(v: string) => {
                  if (regexAiMode && !generatingRegex) {
                    setRegexAiPrompt(v || '');
                  } else if (!generatingRegex) {
                    setRegex(v || '');
                  }
                }}
                language={regexAiMode ? 'plaintext' : undefined}
                customLanguage={regexAiMode ? undefined : regexCustomLanguage}
                useTemplate={false}
                fontSize={13}
              />
            </div>
          </div>

          {/* Magic Wand + Generate Button */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            {/* Show WAND ONLY in normal mode */}
            {!regexAiMode && (
              <button
                type="button"
                onClick={() => {
                  setRegexBackup(regex);
                  setRegexAiMode(true);
                }}
                disabled={generatingRegex}
                title="Generate regex with AI"
                style={{
                  padding: 10,
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  background: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 40,
                  transition: 'all 0.2s ease',
                }}
              >
                <Wand2 size={16} color="#666" />
              </button>
            )}

            {/* Show CREATE BUTTON when: AI mode AND at least 5 characters */}
            {regexAiMode && regexAiPrompt.trim().length >= 5 && (
              <button
                type="button"
                onClick={handleGenerateWithAI}
                disabled={generatingRegex}
                title="Generate regex from description"
                style={{
                  padding: '10px 16px',
                  border: '2px solid #3b82f6',
                  borderRadius: 8,
                  background: generatingRegex ? '#f3f4f6' : '#3b82f6',
                  color: '#fff',
                  cursor: generatingRegex ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  minWidth: 120,
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  animation: 'fadeIn 0.2s ease-in',
                }}
              >
                {generatingRegex ? (
                  <>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 14,
                        height: 14,
                        border: '2px solid #fff',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    <span>Creating...</span>
                  </>
                ) : (
                  'Create Regex'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

