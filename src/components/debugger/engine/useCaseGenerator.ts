import { UseCase, ChatEvent } from './types';

/**
 * Generates use cases for a date of birth DDT: happy path, no input, subdata only year.
 */
export function generateUseCases(ddt: any): UseCase[] {
  // Example: Happy path for date of birth
  const happyPath: UseCase = {
    name: 'Happy Path - Date of Birth',
    description: 'User provides full date in one go.',
    conversation: [
      { from: 'bot', stepId: 'askDOB', text: 'What is your date of birth?', type: 'message' },
      { from: 'user', stepId: 'askDOB', text: '12/05/1990', type: 'input' },
      { from: 'bot', stepId: 'done', text: 'Thank you!', type: 'message' },
    ],
  };

  // Error: no input
  const noInput: UseCase = {
    name: 'No Input',
    description: 'User submits empty input.',
    conversation: [
      { from: 'bot', stepId: 'askDOB', text: 'What is your date of birth?', type: 'message' },
      { from: 'user', stepId: 'askDOB', text: '', type: 'input' },
      { from: 'system', stepId: 'askDOB', text: 'No input detected (noInput escalation).', type: 'action' },
    ],
  };

  // Subdata: only year provided
  const subdata: UseCase = {
    name: 'Subdata - Only Year',
    description: 'User provides only the year.',
    conversation: [
      { from: 'bot', stepId: 'askDOB', text: 'What is your date of birth?', type: 'message' },
      { from: 'user', stepId: 'askDOB', text: '1990', type: 'input' },
      { from: 'bot', stepId: 'askDOB', text: 'Please provide the month.', type: 'message' },
    ],
  };

  return [happyPath, noInput, subdata];
}