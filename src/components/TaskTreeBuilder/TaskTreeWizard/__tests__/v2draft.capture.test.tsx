import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import V2TogglePanel from '../V2TogglePanel';
import { getAllV2Draft, clearV2Draft } from '../V2DraftStore';

describe('V2TogglePanel draft capture', () => {
  it('captures NotConfirmed and Ask.reason into v2Draft when enabled', () => {
    clearV2Draft();
    render(<V2TogglePanel /> as any);
    fireEvent.click(screen.getByLabelText('v2-toggle-panel').querySelector('input')!);
    fireEvent.change(screen.getByLabelText('ask-reason'), { target: { value: 'why.birthdate' } });
    const prompts = ['L1', 'L2', 'L3'];
    fireEvent.change(screen.getByLabelText('prompt-1'), { target: { value: prompts[0] } });
    fireEvent.change(screen.getByLabelText('prompt-2'), { target: { value: prompts[1] } });
    fireEvent.change(screen.getByLabelText('prompt-3'), { target: { value: prompts[2] } });
    const draft = getAllV2Draft();
    expect(draft['__main__']?.ask?.reason).toBe('why.birthdate');
    expect(draft['__main__']?.notConfirmed?.prompts?.length).toBe(3);
  });
});


