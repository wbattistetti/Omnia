import React from 'react';
import { Wand2 } from 'lucide-react';

interface RegexInlineEditorProps {
  regex: string;
  setRegex: (value: string) => void;
  onClose: () => void;
}

/**
 * Inline editor for configuring regex patterns
 * Supports AI-powered regex generation
 */
export default function RegexInlineEditor({
  regex,
  setRegex,
  onClose,
}: RegexInlineEditorProps) {
  const [regexAiMode, setRegexAiMode] = React.useState(false);
  const [regexAiPrompt, setRegexAiPrompt] = React.useState('');
  const [regexBackup, setRegexBackup] = React.useState('');
  const [generatingRegex, setGeneratingRegex] = React.useState(false);
  const regexInputRef = React.useRef<HTMLInputElement>(null);

  const handleGenerateWithAI = async () => {
    if (!regexAiPrompt.trim()) return;

    setGeneratingRegex(true);
    try {
      console.log('[AI Regex] Generating regex for:', regexAiPrompt);

      const response = await fetch('/api/nlp/generate-regex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: regexAiPrompt }),
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
        `Error generating regex: ${
          error instanceof Error ? error.message : 'Unknown error'
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={regexInputRef}
            value={
              generatingRegex
                ? '⏳ Creating regex...'
                : regexAiMode
                ? regexAiPrompt
                : regex
            }
            onChange={(e) => {
              if (regexAiMode && !generatingRegex) {
                setRegexAiPrompt(e.target.value);
              } else if (!generatingRegex) {
                setRegex(e.target.value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && regexAiMode) {
                setRegexAiMode(false);
                setRegex(regexBackup);
                e.preventDefault();
                console.log(
                  '[AI Regex] Cancelled via ESC - restored:',
                  regexBackup
                );
              }
            }}
            placeholder={
              regexAiMode && !generatingRegex
                ? 'Describe here what the regex should match (in English)'
                : 'es. \\b\\d{5}\\b'
            }
            disabled={generatingRegex}
            style={{
              flex: 1,
              padding: 10,
              border: regexAiMode ? '2px solid #3b82f6' : '1px solid #ddd',
              borderRadius: 8,
              fontFamily: regexAiMode ? 'inherit' : 'monospace',
              backgroundColor: generatingRegex
                ? '#f9fafb'
                : regexAiMode
                ? '#eff6ff'
                : '#fff',
              transition: 'all 0.2s ease',
            }}
          />

          {/* Show WAND ONLY in normal mode */}
          {!regexAiMode && (
            <button
              type="button"
              onClick={() => {
                setRegexBackup(regex);
                setRegexAiMode(true);
                setTimeout(() => {
                  regexInputRef.current?.focus();
                }, 0);
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
  );
}

