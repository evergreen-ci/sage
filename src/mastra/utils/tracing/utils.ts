import { MessageListInput } from '@mastra/core/dist/agent/message-list';

/**
 * Extracts the text from a MessageListInput
 * @param input - The MessageListInput to extract the text from
 * @returns The concatenated text from the MessageListInput
 */
export const extractText = (input: MessageListInput): string => {
  if (typeof input === 'string') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(item => extractText(item as MessageListInput)).join(' ');
  }

  if (input.role !== 'user' && input.role !== 'assistant') {
    return '';
  }

  if (!('parts' in input) || !input.parts) {
    return '';
  }

  return input.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join(' ');
};
