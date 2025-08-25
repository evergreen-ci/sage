import { CoreMessage } from '@mastra/core';

export const getMessageContent = (message: CoreMessage) => {
  switch (message.role) {
    case 'user':
      return message.content.toString();
    case 'assistant':
      if (typeof message.content === 'string') {
        return message.content;
      }
      return decodeAssistantContent(message.content);

    case 'system':
      return message.content;
    default:
      throw new Error(`Unknown message role: ${message.role}`);
  }
};

const decodeAssistantContent = (part: any): string => {
  if (!part) {
    return '';
  }
  if (typeof part === 'string') {
    return part;
  }
  if (Array.isArray(part)) {
    return part.map(decodeAssistantContentPart).join('');
  }
  return '';
};

const decodeAssistantContentPart = (part: any) => {
  if (!part) {
    return '';
  }
  switch (part.type) {
    case 'text':
      return part.text;
    case 'file':
      return part.data.toString();
    case 'tool-call':
      return part.toolName;
    case 'reasoning':
      return part.reasoning;
    case 'redacted-reasoning':
      return '[reasoning redacted]';
    default:
      return '';
  }
};
