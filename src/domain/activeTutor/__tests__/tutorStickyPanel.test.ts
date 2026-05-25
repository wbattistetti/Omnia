import { describe, expect, it } from 'vitest';
import {
  collectTutorPhaseContextBodies,
  filterTutorConversationMessages,
  isTutorPhaseContextChatMessage,
  resolveTutorStickyPanelContent,
} from '../tutorStickyPanel';
import { TUTOR_PHASE_INTRO } from '../tutorPhaseIntro';
import { TUTOR_WELCOME_STRUCTURED } from '../tutorScripts';
import { EMPTY_TUTOR_SCRIPT_CONTEXT } from '../tutorScriptContext';

describe('resolveTutorStickyPanelContent', () => {
  it('returns intro and idle backend script for backend tab', () => {
    const content = resolveTutorStickyPanelContent({
      phase: 2,
      phaseKey: 'backend',
      phaseState: 'idle',
      backendSubView: 'main',
      scriptContext: EMPTY_TUTOR_SCRIPT_CONTEXT,
      phaseComplete: false,
    });

    expect(content.introText).toBe(TUTOR_PHASE_INTRO.backend);
    expect(content.stateMessage?.body).toMatch(/Aggiungi i backend/i);
    expect(content.warningText).toBeTruthy();
  });
});

describe('filterTutorConversationMessages', () => {
  it('hides phase context messages but keeps welcome and designer turns', () => {
    const messages = [
      { role: 'tutor' as const, structured: TUTOR_WELCOME_STRUCTURED },
      {
        role: 'tutor' as const,
        structured: {
          title: 'Backend',
          body: TUTOR_PHASE_INTRO.backend,
          actions: [],
          uiRefs: [],
          ensureView: null,
        },
      },
      { role: 'designer' as const, text: 'Come importo un backend?' },
    ];

    const filtered = filterTutorConversationMessages(messages, 'backend');
    expect(filtered).toHaveLength(2);
    expect(filtered[0]?.structured?.title).toBe(TUTOR_WELCOME_STRUCTURED.title);
    expect(filtered[1]?.text).toMatch(/importo/i);
  });

  it('detects intro text as context message', () => {
    expect(
      isTutorPhaseContextChatMessage(
        {
          role: 'tutor',
          structured: {
            title: 'Backend',
            body: TUTOR_PHASE_INTRO.backend,
          },
        },
        'backend'
      )
    ).toBe(true);
  });

  it('collects multiple context bodies per phase', () => {
    expect(collectTutorPhaseContextBodies('backend').size).toBeGreaterThan(3);
  });
});
