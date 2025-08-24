import React from 'react';
import { useBackendBuilder } from '../../state/BackendBuilderContext';

export default function StepDesign() {
  const {
    messages, addMessage, aiTyping, replyFromAI,
    contextState, appendContext, lastDelta, clearDelta,
  } = useBackendBuilder();

  const [draftMsg, setDraftMsg] = React.useState('');
  const [loadingAI] = React.useState(false);

  const formatOutline = (text: string) => text.replace(/\n{2,}(\d+\))/g, '\n\n$1');

  const send = async () => {
    const msg = draftMsg.trim();
    if (!msg) return;
    addMessage({ role: 'designer', text: msg });
    setDraftMsg('');
    await replyFromAI([{ role: 'designer', text: msg }]);
  };

  // AI inline NOTE editing
  const aiDivRef = React.useRef<HTMLDivElement | null>(null);
  const lastAiIndex = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'ai') return i;
    return -1;
  }, [messages]);

  // local mirror of AI text to detect NOTE: instantly
  const [inlineText, setInlineText] = React.useState('');
  React.useEffect(() => {
    if (lastAiIndex >= 0) setInlineText(messages[lastAiIndex].text || '');
  }, [lastAiIndex]);

  const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const toHtml = (s: string) => {
    const lines = s.split(/\n/);
    return lines
      .map(line => line.trim().startsWith('NOTE:')
        ? `<span style="color:#f59e0b">${escapeHtml(line)}</span>`
        : escapeHtml(line))
      .join('\n');
  };

  const bubbleStyle = (role: 'designer' | 'ai'): React.CSSProperties => ({
    background: '#0b1220',
    color: '#e5e7eb',
    border: `1px solid ${role === 'ai' ? '#38bdf8' : '#22c55e'}`,
    borderRadius: 8,
    padding: '8px 10px',
    position: 'relative',
  });

  const labelStyle = (role: 'designer' | 'ai'): React.CSSProperties => ({
    fontSize: 11,
    marginBottom: 2,
    color: role === 'ai' ? '#38bdf8' : '#22c55e',
    fontWeight: 600,
  });

  const updateModelFromDom = () => {
    if (lastAiIndex < 0) return;
    const el = aiDivRef.current;
    if (!el) return;
    const txt = el.innerText;
    setInlineText(txt);
    messages[lastAiIndex].text = txt; // keep NOTE: markers in model
  };

  const handleAiKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (lastAiIndex < 0) return;
    const el = aiDivRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer)) return;

    // Intercept printable characters to inject NOTE: when needed
    const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!printable) return; // allow navigation/backspace/etc.

    // Compute text from start to caret
    const preRange = document.createRange();
    preRange.selectNodeContents(el);
    preRange.setEnd(range.startContainer, range.startOffset);
    const beforeText = preRange.toString();
    const lineStart = beforeText.lastIndexOf('\n') + 1;
    const linePrefix = beforeText.slice(lineStart);
    const alreadyNote = /^\s*NOTE:\s*/i.test(linePrefix);
    if (alreadyNote) return; // allow default typing inside note

    // Need to insert "NOTE: " + char at caret and color it
    e.preventDefault();
    const span = document.createElement('span');
    span.style.color = '#f59e0b';
    span.textContent = `NOTE: ${e.key}`;
    range.insertNode(span);

    // Move caret to after inserted char inside span
    const newRange = document.createRange();
    newRange.setStart(span.firstChild || span, (span.textContent || '').length);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    // Sync model
    updateModelFromDom();
  };

  const handleAiInput = () => updateModelFromDom();

  const hasNotes = React.useMemo(() => /(^|\n)\s*NOTE:\s*/i.test(inlineText || ''), [inlineText]);
  const sendInlineNotes = async () => {
    const notes = (inlineText || '').split('\n').filter(l => l.trim().toUpperCase().startsWith('NOTE:'));
    if (notes.length === 0) return;
    const preamble = 'Il designer ha inserito delle note; rispondi includendo anche le risposte alle note.';
    await replyFromAI([{ role: 'ai', text: preamble }, { role: 'designer', text: notes.join('\n') }]);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
      {/* Chat guidata */}
      <section style={{ background: '#111827', border: '1px solid #222', borderRadius: 8, padding: 12, display: 'grid', gridTemplateRows: '1fr auto', minHeight: 300 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Chat (Designer ↔ IA)</div>
        <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map((m, idx) => (
            <div key={m.id} style={{ width: '100%' }}>
              <div style={bubbleStyle(m.role)}>
                <div style={labelStyle(m.role)}>{m.role === 'ai' ? 'Consultant' : 'Designer'}</div>
                {m.role === 'ai' ? (
                  <>
                    <div
                      ref={idx === lastAiIndex ? aiDivRef : undefined}
                      contentEditable={idx === lastAiIndex}
                      suppressContentEditableWarning
                      onKeyDown={idx === lastAiIndex ? handleAiKeyDown : undefined}
                      onInput={idx === lastAiIndex ? handleAiInput : undefined}
                      style={{ whiteSpace: 'pre-wrap', outline: 'none' }}
                      dangerouslySetInnerHTML={{ __html: toHtml(formatOutline(idx === lastAiIndex ? inlineText : m.text)) }}
                    />
                    {idx === lastAiIndex && hasNotes && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                        <button onClick={sendInlineNotes} style={{ background: '#f59e0b', color: '#111827', border: '1px solid #d97706', borderRadius: 6, padding: '6px 10px', fontWeight: 700 }}>Invia note</button>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                )}
              </div>
            </div>
          ))}
          {aiTyping && (
            <div style={{ width: '100%' }}>
              <div style={bubbleStyle('ai')}>
                <div style={labelStyle('ai')}>Consultant</div>
                <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>IA sta scrivendo…</div>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 8 }}>
          <input
            value={draftMsg}
            onChange={e => setDraftMsg(e.target.value)}
            placeholder={`Scrivi qui… (contesto: ${contextState.length} caratteri)`}
            style={{ background: '#0b1220', color: '#e5e7eb', border: '1px solid #1f2937', borderRadius: 6, padding: '8px 10px' }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button onClick={send} style={{ background: '#2563eb', color: '#fff', border: '1px solid #1d4ed8', borderRadius: 6, padding: '8px 12px', fontWeight: 700 }}>Invia</button>
        </div>
        {lastDelta && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ color: '#fbbf24', fontSize: 12 }}>Delta CONTESTO_STATO suggerito: {lastDelta}</div>
            <button onClick={() => { appendContext(lastDelta); clearDelta(); }} style={{ background: '#22c55e', color: '#0b1220', border: '1px solid #16a34a', borderRadius: 6, padding: '6px 10px', fontWeight: 700 }}>Aggiungi al contesto</button>
          </div>
        )}
      </section>
    </div>
  );
}

const chipStyle: React.CSSProperties = { background: 'transparent', color: '#e5e7eb', border: '1px solid #334155', borderRadius: 9999, padding: '6px 10px', fontSize: 12 };


