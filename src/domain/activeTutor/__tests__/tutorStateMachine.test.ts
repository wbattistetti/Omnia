import { describe, expect, it } from 'vitest';
import {
  applyTutorTransition,
  tutorAttentionAllowed,
  tutorShouldBeSilent,
} from '../tutorStateMachine';

describe('tutorStateMachine', () => {
  it('follows official transition table', () => {
    expect(applyTutorTransition('idle', 'ai_action_started')).toBe('waiting_for_ai');
    expect(applyTutorTransition('waiting_for_ai', 'ai_action_completed')).toBe('ai_completed');
    expect(applyTutorTransition('ai_completed', 'user_edit')).toBe('iterating');
    expect(applyTutorTransition('iterating', 'phase_confirm_clicked')).toBe('awaiting_confirmation');
    expect(applyTutorTransition('awaiting_confirmation', 'wizard_step_advanced')).toBe('completed');
  });

  it('allows ai_completed to skip iterating on phase confirm', () => {
    expect(applyTutorTransition('ai_completed', 'phase_confirm_clicked')).toBe(
      'awaiting_confirmation'
    );
  });

  it('is silent during waiting_for_ai', () => {
    expect(tutorShouldBeSilent('waiting_for_ai')).toBe(true);
    expect(tutorAttentionAllowed('waiting_for_ai')).toBe(false);
  });

  it('does not change state on invalid transitions', () => {
    expect(applyTutorTransition('idle', 'wizard_step_advanced')).toBe('idle');
    expect(applyTutorTransition('completed', 'user_edit')).toBe('completed');
  });
});
