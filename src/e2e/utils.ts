import { CoreMessage } from '@mastra/core';

export const getMessageContent = (message: CoreMessage) => {
  switch (message.role) {
    case 'user':
      return message.content.toString();
    case 'assistant':
      if (typeof message.content === 'string') {
        return message.content;
      }
      // Custom implementation for AssistantContent decoding
      return decodeAssistantContentCustom(message.content);

    case 'system':
      return message.content;
    default:
      throw new Error(`Unknown message role: ${message.role}`);
  }
};

const decodeAssistantContentCustom = (content: any): string => {
  if (!content) {
    return '';
  }
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map(decodeAssistantContentPart).join('');
  }
  return '';
};

const decodeAssistantContentPart = (part: any) => {
  if (!part) {
    return '';
  }
  switch (part.type) {
    case 'text':
      return part.text || '';
    case 'file':
      // Handle file parts with data
      return part.data ? part.data.toString() : '';
    case 'tool-call':
      return part.toolName || '';
    case 'tool-result':
      return part.result || '';
    case 'reasoning':
      return part.reasoning || '';
    case 'redacted-reasoning':
      return '[reasoning redacted]';
    default:
      return '';
  }
};
