import type { Message } from '@components/ChatSimulator/UserMessage';
import type { UseCase, UseCaseStep } from '../model';

/**
 * Converts debugger transcript messages to replay steps.
 */
export function buildUseCaseFromDebuggerMessages(input: {
  id: string;
  key: string;
  label: string;
  messages: readonly Message[];
}): UseCase {
  const { id, key, label, messages } = input;
  const uid = String(id || '').trim();
  const dotKey = String(key || '').trim();
  const labelKey = String(label || '').trim();
  if (!uid || !dotKey || !labelKey) {
    throw new Error('buildUseCaseFromDebuggerMessages: id, key, label are required.');
  }

  const steps: UseCaseStep[] = [];
  for (let i = 0; i < messages.length; i += 1) {
    const row = messages[i];
    if (row.type !== 'user') continue;
    const bot = findNextBotMessage(messages, i + 1);
    const semanticValue = (row.extractedValues || [])
      .map((x) => `${x.variable}:${String(x.semanticValue ?? '')}`)
      .join('|');
    const linguisticValue = (row.extractedValues || [])
      .map((x) => `${x.variable}:${String(x.linguisticValue ?? '')}`)
      .join('|');
    steps.push({
      userUtterance: String(row.text || ''),
      semanticValue,
      linguisticValue,
      grammarUsed: {
        type: String(bot?.stepType || ''),
        contract: String(bot?.textKey || ''),
      },
      botResponse: String(bot?.text || ''),
    });
  }

  return {
    id: uid,
    key: dotKey,
    label: labelKey,
    steps,
  };
}

function findNextBotMessage(messages: readonly Message[], fromIndex: number): Message | null {
  for (let i = fromIndex; i < messages.length; i += 1) {
    if (messages[i].type === 'bot') return messages[i];
  }
  return null;
}

