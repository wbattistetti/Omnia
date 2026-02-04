import React, { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import ProgressBar from '../../../TaskTreeBuilder/TaskTreeWizard/components/ProgressBar';
import { useAIProvider } from '../../../../context/AIProviderContext';

interface IntentMessagesBuilderProps {
  intentLabel: string;
  onComplete: (messages: IntentMessages) => void;
  onCancel?: () => void;
}

export interface IntentMessages {
  start: string[];
  noInput: string[];
  noMatch: string[];
  confirmation: string[];
}

// Prompt per generazione messaggi intent classification
const INTENT_CLASSIFICATION_MESSAGES_PROMPT = (intentLabel: string) => `
You are an expert in designing conversational flows for customer care call centers.

CONTEXT:
You need to generate natural, spoken messages in Italian for an intent classification system. The system asks customers about the reason for their call (their intent/problem category) and handles cases where the customer doesn't respond or the system doesn't understand the response.

TASK:
Generate conversational messages in Italian for a voice-based customer care system that classifies customer intents.

INPUT INFORMATION:
- Intent label: "${intentLabel}"
  This describes what the system is asking (e.g., "chiedi il problema", "chiedi il motivo della chiamata", "chiedi la tipologia di richiesta")

STYLE REQUIREMENTS:
- Natural Italian spoken language (not written/formal)
- Short sentences (6-15 words maximum)
- Professional but warm and human tone
- Phone conversation style: direct, clear, conversational
- Use light contractions when natural (può, devo, voglio)
- Polite and respectful
- No emojis, no exclamation marks except when necessary for clarification
- Do NOT use UI terms like "clicca", "digita", "inserisci"
- Use "dica", "dimmi", "può dire" for spoken interaction
- Do NOT include example values or placeholders in the main messages (except confirmation)
- Each message should feel like a real agent speaking

MESSAGE TYPES TO GENERATE:

1. START (1 message):
   - Initial question to ask the customer about their reason for calling
   - Must end with a question mark
   - Example style: "Mi può dire il motivo della chiamata?" or "Qual è il motivo della sua richiesta?"
   - Use the intent label to craft a natural question

2. NOINPUT (3 variations):
   - Used when the customer doesn't respond or remains silent
   - Each variation should be slightly different but equally polite
   - Progressive but not urgent/pushy
   - Examples:
     * "Scusi, non ho capito. Può ripetere il motivo?"
     * "Mi scusi, può dirmi qual è il problema?"
     * "Può ripetere, per favore?"

3. NOMATCH (3 variations):
   - Used when the system doesn't understand what the customer said
   - Should encourage the customer to rephrase or be more specific
   - Polite clarification requests
   - Examples:
     * "Non ho capito bene. Può spiegarmi meglio il motivo?"
     * "Scusi, può essere più specifico sul problema?"
     * "Non sono sicuro di aver capito. Può ripetere il motivo in altro modo?"

4. CONFIRMATION (1 message):
   - Used to confirm the identified intent before proceeding
   - Should include a placeholder for the detected intent
   - Format: "Il motivo è {{ '{intent}' }}. È corretto?"
   - Example: "Il motivo della chiamata è: cancellazione. È corretto?"

OUTPUT FORMAT (strict JSON, no markdown, no comments):
{
  "start": [
    "Messaggio iniziale per chiedere l'intento"
  ],
  "noInput": [
    "Prima variazione quando il cliente non risponde",
    "Seconda variazione quando il cliente non risponde",
    "Terza variazione quando il cliente non risponde"
  ],
  "noMatch": [
    "Prima variazione quando il sistema non capisce",
    "Seconda variazione quando il sistema non capisce",
    "Terza variazione quando il sistema non capisce"
  ],
  "confirmation": [
    "Il motivo è {{ '{intent}' }}. È corretto?"
  ]
}

IMPORTANT RULES:
- All messages must be in Italian
- Start messages must end with "?"
- Confirmation must include {{ '{intent}' }} placeholder
- NoInput and noMatch should have 3 different variations each
- Messages should feel natural and conversational, not robotic
- Avoid redundancy across variations
- Each variation should be slightly different in wording but similar in meaning

Now generate the messages based on the intent label: "${intentLabel}"
`;

export default function IntentMessagesBuilder({ intentLabel: initialIntentLabel, onComplete, onCancel }: IntentMessagesBuilderProps) {
  const { provider: selectedProvider } = useAIProvider();
  const [intentLabel, setIntentLabel] = useState(initialIntentLabel || '');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Initialize textarea with initial value
  useEffect(() => {
    if (textareaRef.current && (!intentLabel || intentLabel.trim().length === 0)) {
      textareaRef.current.value = initialIntentLabel || '';
      setIntentLabel(initialIntentLabel || '');
    }
  }, [initialIntentLabel]);

  const handleGenerate = async () => {
    const trimmedLabel = intentLabel.trim();
    if (!trimmedLabel) return;

    setGenerating(true);
    setProgress(0);
    setError(null);

    try {
      // Step 1: Generate messages (20%)
      setProgress(20);

      const prompt = INTENT_CLASSIFICATION_MESSAGES_PROMPT(trimmedLabel);

      // Call backend endpoint (we'll create this later)
      // For now, use a temporary approach: call AI directly from frontend
      // TODO: Move to backend endpoint /api/intentMessages

      const response = await fetch('/api/intentMessages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentLabel: trimmedLabel,
          provider: selectedProvider.toLowerCase(),
        }),
      });

      setProgress(60);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate messages: ${response.status} ${errorText}`);
      }

      const data = await response.json();

      setProgress(80);

      // Parse and validate messages
      const rawMessages: any = data.messages || data;

      if (!rawMessages.start || !rawMessages.noInput || !rawMessages.noMatch || !rawMessages.confirmation) {
        throw new Error('Invalid message structure received from AI');
      }

      // Ensure arrays have correct lengths
      const validated: IntentMessages = {
        start: Array.isArray(rawMessages.start) ? rawMessages.start : (rawMessages.start ? [String(rawMessages.start)] : []),
        noInput: Array.isArray(rawMessages.noInput) ? rawMessages.noInput.slice(0, 3) : (rawMessages.noInput ? [String(rawMessages.noInput)] : []),
        noMatch: Array.isArray(rawMessages.noMatch) ? rawMessages.noMatch.slice(0, 3) : (rawMessages.noMatch ? [String(rawMessages.noMatch)] : []),
        confirmation: Array.isArray(rawMessages.confirmation) ? rawMessages.confirmation : (rawMessages.confirmation ? [String(rawMessages.confirmation)] : []),
      };

      setProgress(100);

      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 300));

      onComplete(validated);
    } catch (err) {
      console.error('[IntentMessagesBuilder] Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate messages');
      setGenerating(false);
      setProgress(0);
    }
  };

  // Show progress bar during generation (overlay style)
  if (generating) {
    return (
      <div
        style={{
          background: 'transparent',
          border: 'none',
          borderRadius: 0,
          padding: '16px 20px',
          maxWidth: 'unset',
          margin: 0,
          boxSizing: 'border-box',
        }}
      >
        {/* Header: instruction line */}
        <div style={{ fontSize: 15, fontWeight: 500, color: '#cbd5e1', marginBottom: 12 }}>
          Describe the intent or question the virtual agent must ask to classify the user's problem:
        </div>

        {/* Textarea (read-only during generation) */}
        <textarea
          ref={textareaRef}
          value={intentLabel}
          readOnly
          disabled
          rows={2}
          style={{
            fontSize: 17,
            padding: '10px 16px',
            width: '100%',
            borderRadius: 8,
            border: '1px solid #4b5563',
            outline: 'none',
            marginBottom: 20,
            background: '#1f2937',
            color: '#9ca3af',
            boxSizing: 'border-box',
            resize: 'vertical',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            cursor: 'not-allowed',
          }}
        />

        {/* Progress bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Loader2 size={16} className="animate-spin" style={{ color: '#3b82f6' }} />
            <span style={{ fontSize: 14, color: '#cbd5e1' }}>Generating messages...</span>
            <span style={{ fontSize: 14, color: '#9ca3af', marginLeft: 'auto' }}>
              {Math.round(progress)}%
            </span>
          </div>
          <ProgressBar progress={progress / 100} />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <button
            onClick={onCancel}
            disabled={generating}
            style={{
              background: '#fff',
              color: '#000',
              border: '1px solid #000',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: generating ? 'not-allowed' : 'pointer',
              padding: '6px 16px',
              opacity: generating ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            Annulla
          </button>
          <button
            disabled
            style={{
              background: '#22c55e',
              color: '#fff',
              border: '1px solid #22c55e',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'not-allowed',
              padding: '8px 28px',
              opacity: 0.6,
            }}
          >
            Generate Messages
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div style={{ marginTop: 16, padding: 12, background: '#7f1d1d', borderRadius: 8, color: '#fca5a5' }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          background: 'transparent',
          border: 'none',
          borderRadius: 0,
          padding: '16px 20px',
          maxWidth: 'unset',
          margin: 0,
          boxSizing: 'border-box',
        }}
      >
        {/* Header: instruction line */}
        <div style={{ fontSize: 15, fontWeight: 500, color: '#cbd5e1', marginBottom: 12 }}>
          Describe the intent or question the virtual agent must ask to classify the user's problem:
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={intentLabel}
          onChange={e => setIntentLabel(e.target.value)}
          rows={2}
          style={{
            fontSize: 17,
            padding: '10px 16px',
            width: '100%',
            borderRadius: 8,
            border: '1px solid #4b5563',
            outline: 'none',
            marginBottom: 20,
            background: '#111827',
            color: '#fff',
            boxSizing: 'border-box',
            resize: 'vertical',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && intentLabel.trim()) {
              e.preventDefault();
              handleGenerate();
            }
          }}
          autoFocus
        />

        {/* Error message */}
        <div style={{ marginBottom: 16, padding: 12, background: '#7f1d1d', borderRadius: 8, color: '#fca5a5' }}>
          {error}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <button
            onClick={onCancel}
            style={{
              background: '#fff',
              color: '#000',
              border: '1px solid #000',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              padding: '6px 16px',
              transition: 'all 0.2s ease'
            }}
          >
            Annulla
          </button>
          <button
            onClick={() => {
              setError(null);
              setProgress(0);
            }}
            style={{
              background: '#3b82f6',
              color: '#fff',
              border: '1px solid #3b82f6',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              padding: '8px 28px',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Normal state (editing)
  return (
    <div
      style={{
        background: 'transparent',
        border: 'none',
        borderRadius: 0,
        padding: '16px 20px',
        maxWidth: 'unset',
        margin: 0,
        boxSizing: 'border-box',
      }}
    >
      {/* Header: instruction line */}
      <div style={{ fontSize: 15, fontWeight: 500, color: '#cbd5e1', marginBottom: 12 }}>
        Describe the intent or question the virtual agent must ask to classify the user's problem:
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={intentLabel}
        onChange={e => setIntentLabel(e.target.value)}
        placeholder="e.g., chiedi il problema, chiedi il motivo della chiamata"
        rows={2}
        style={{
          fontSize: 17,
          padding: '10px 16px',
          width: '100%',
          borderRadius: 8,
          border: '1px solid #4b5563',
          outline: 'none',
          marginBottom: 20,
          background: '#111827',
          color: '#fff',
          boxSizing: 'border-box',
          resize: 'vertical',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && intentLabel.trim()) {
            e.preventDefault();
            handleGenerate();
          }
        }}
        autoFocus
      />

      {/* Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        {/* 🎨 Pulsante Annulla: sfondo bianco, bordo nero, testo nero */}
        <button
          onClick={onCancel}
          style={{
            background: '#fff',
            color: '#000',
            border: '1px solid #000',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            padding: '6px 16px',
            transition: 'all 0.2s ease'
          }}
        >
          Annulla
        </button>
        {/* 🎨 Pulsante Generate Messages: sfondo verde, bordo verde, testo bianco */}
        <button
          onClick={handleGenerate}
          disabled={!intentLabel.trim()}
          style={{
            background: '#22c55e',
            color: '#fff',
            border: '1px solid #22c55e',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            cursor: intentLabel.trim() ? 'pointer' : 'not-allowed',
            padding: '8px 28px',
            opacity: intentLabel.trim() ? 1 : 0.6,
            transition: 'opacity 0.2s',
          }}
        >
          Generate Messages
        </button>
      </div>
    </div>
  );
}

