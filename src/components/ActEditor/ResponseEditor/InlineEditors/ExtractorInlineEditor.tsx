import React from 'react';
import EditorPanel from '../../../CodeEditor/EditorPanel';
import { Wand2, Loader2, RefreshCw } from 'lucide-react';

interface ExtractorInlineEditorProps {
  onClose: () => void;
}

const TEMPLATE_CODE = `// AI-generated extractor will appear here
// Click the magic wand (🪄) to generate code from a description

export const customExtractor: DataExtractor<string> = {
  extract(text: string) {
    // Parse input text
    const value = text.trim();
    return { value, confidence: 0.8 };
  },
  
  validate(value: string) {
    // Validate extracted value
    if (!value) return { ok: false, errors: ['empty-value'] };
    return { ok: true };
  },
  
  format(value: string) {
    // Format for display
    return value;
  }
};`;

/**
 * Inline editor for configuring deterministic extractor with AI code generation
 * Uses Monaco Editor for TypeScript code editing
 */
export default function ExtractorInlineEditor({
  onClose,
}: ExtractorInlineEditorProps) {
  const [extractorCode, setExtractorCode] = React.useState<string>(TEMPLATE_CODE);
  const [aiMode, setAiMode] = React.useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = React.useState<string>('');
  const [codeBackup, setCodeBackup] = React.useState<string>('');
  const [generating, setGenerating] = React.useState<boolean>(false);
  const [lastAiPrompt, setLastAiPrompt] = React.useState<string>('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Detect if code has been modified (CREATE vs REFINE mode)
  const isCodeModified = React.useMemo(() => {
    const normalized = extractorCode.trim();
    const templateNormalized = TEMPLATE_CODE.trim();
    
    // Code is modified if:
    // 1. Not empty
    // 2. Different from template
    // 3. Has meaningful content (not just comments)
    if (!normalized || normalized === templateNormalized) return false;
    
    // Check if there's actual code beyond comments
    const codeWithoutComments = normalized.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const hasCode = codeWithoutComments.length > 50;
    
    return hasCode;
  }, [extractorCode]);

  // Auto-focus when entering AI mode
  React.useEffect(() => {
    if (aiMode && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [aiMode]);

  const handleWandClick = () => {
    // 🔄 REFINE mode: Auto-start refinement using TODOs/comments in code
    if (isCodeModified) {
      handleRefineAutoStart();
    } else {
      // 🪄 CREATE mode: Enter AI description mode
      setCodeBackup(extractorCode);
      setAiMode(true);
      // Restore last AI prompt if available
      if (lastAiPrompt) {
        setAiPrompt(lastAiPrompt);
      }
    }
  };

  // 🔄 Auto-start refinement without user input (uses TODOs/comments)
  const handleRefineAutoStart = async () => {
    setGenerating(true);
    
    try {
      const response = await fetch('/api/nlp/refine-extractor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: extractorCode,
          improvements: 'Implement TODO comments and suggestions found in the code',
          dataType: 'string'
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.ok && data.result?.refined_code) {
        setExtractorCode(data.result.refined_code);
      } else {
        alert('AI refinement failed. Please try again.');
      }
    } catch (error) {
      console.error('[ExtractorEditor] AI refine auto-start error:', error);
      alert('Error refining extractor code. Check console for details.');
    } finally {
      setGenerating(false);
    }
  };

  const handleEscape = () => {
    setAiMode(false);
    setExtractorCode(codeBackup);
    setAiPrompt('');
  };

  const handleGenerate = async () => {
    if (aiPrompt.trim().length < 5) return;
    
    setGenerating(true);
    setLastAiPrompt(aiPrompt); // Remember for next time
    
    try {
      // Choose endpoint based on mode
      const endpoint = isCodeModified 
        ? '/api/nlp/refine-extractor'   // REFINE: improve existing code
        : '/api/nlp/generate-extractor'; // CREATE: generate from scratch
      
      const body = isCodeModified 
        ? {
            code: extractorCode,        // Send existing code
            improvements: aiPrompt,     // User's improvement requests
            dataType: 'string'
          }
        : {
            description: aiPrompt,      // Natural language description
            dataType: 'string'
          };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.code) {
        setExtractorCode(data.code);
        setAiMode(false);
        setAiPrompt('');
      } else {
        alert(`AI ${isCodeModified ? 'refinement' : 'generation'} failed. Please try again.`);
      }
    } catch (error) {
      console.error(`[ExtractorEditor] AI ${isCodeModified ? 'refine' : 'generate'} error:`, error);
      alert(`Error ${isCodeModified ? 'refining' : 'generating'} extractor code. Check console for details.`);
    } finally {
      setGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleEscape();
    } else if (e.key === 'Enter' && e.ctrlKey && aiPrompt.trim().length >= 5) {
      e.preventDefault();
      handleGenerate();
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
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          🪄 Configure Extractor
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

      {/* Monaco Editor + Magic Wand */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, fontSize: 14 }}>
          TypeScript Extractor Code
        </label>
        
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          {/* Monaco or AI Prompt Textarea */}
          <div style={{ flex: 1, position: 'relative' }}>
            {generating ? (
              <div
                style={{
                  height: 500,
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#fff',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <Loader2 size={32} className="animate-spin" style={{ color: isCodeModified ? '#f59e0b' : '#3b82f6' }} />
                <span style={{ fontSize: 14, color: '#666' }}>
                  {isCodeModified ? '🔄 Refining extractor code...' : '🪄 Generating extractor code...'}
                </span>
              </div>
            ) : aiMode ? (
              <>
                <textarea
                  ref={textareaRef}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isCodeModified 
                    ? "Describe improvements (e.g., 'implement TODOs', 'add validation for...', 'support Italian numbers')..." 
                    : "Describe what you want to extract... (min 5 characters)"
                  }
                  style={{
                    width: '100%',
                    height: 120,
                    padding: 12,
                    border: '2px solid #3b82f6',
                    borderRadius: 8,
                    fontSize: 14,
                    fontFamily: 'monospace',
                    resize: 'vertical',
                    outline: 'none',
                    background: '#fff',
                    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
                  }}
                />
                {aiPrompt.trim().length >= 5 && (
                  <button
                    onClick={handleGenerate}
                    style={{
                      marginTop: 8,
                      padding: '8px 16px',
                      background: isCodeModified ? '#f59e0b' : '#3b82f6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      animation: 'fadeIn 0.2s ease-in'
                    }}
                  >
                    {isCodeModified ? (
                      <>
                        <RefreshCw size={16} />
                        Refine Extractor (Ctrl+Enter)
                      </>
                    ) : (
                      <>
                        <Wand2 size={16} />
                        Create Extractor (Ctrl+Enter)
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <div style={{ height: 500, border: '1px solid #334155', borderRadius: 8, overflow: 'hidden' }}>
                <EditorPanel
                  code={extractorCode}
                  onChange={setExtractorCode}
                  fontSize={13}
                  varKeys={[]}
                  language="typescript"
                />
              </div>
            )}
          </div>

          {/* AI Button - Changes icon/color based on CREATE vs REFINE mode */}
          {!aiMode && !generating && (
            <button
              onClick={handleWandClick}
              title={isCodeModified 
                ? "🔄 Refine: Improve existing code based on your comments/TODOs" 
                : "🪄 Create: Generate new extractor from description"
              }
              style={{
                height: 40,
                minWidth: 40,
                padding: 10,
                background: isCodeModified
                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' // Orange for REFINE
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Purple for CREATE
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                boxShadow: isCodeModified
                  ? '0 2px 8px rgba(245, 158, 11, 0.3)'
                  : '0 2px 8px rgba(102, 126, 234, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = isCodeModified
                  ? '0 4px 12px rgba(245, 158, 11, 0.5)'
                  : '0 4px 12px rgba(102, 126, 234, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = isCodeModified
                  ? '0 2px 8px rgba(245, 158, 11, 0.3)'
                  : '0 2px 8px rgba(102, 126, 234, 0.3)';
              }}
            >
              {isCodeModified ? (
                <RefreshCw size={16} color="#fff" />
              ) : (
                <Wand2 size={16} color="#fff" />
              )}
            </button>
          )}
        </div>

        {aiMode && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#666', fontStyle: 'italic' }}>
            💡 Press ESC to cancel • Ctrl+Enter to generate
          </div>
        )}
      </div>
    </div>
  );
}

