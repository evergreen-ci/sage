import { UIMessage, UIMessagePart } from 'ai';

export const getMessageContent = (message: UIMessage) => {
  switch (message.role) {
    case 'user':
      return decodeAIV5Content(message.parts);
    case 'assistant':
      return decodeAIV5Content(message.parts);

    case 'system':
      return message.parts.toString();
    default:
      throw new Error(`Unknown message role: ${message.role}`);
  }
};

const decodeAIV5Content = (
  part: UIMessagePart<any, any>[] | undefined
): string => {
  if (!part) {
    return '';
  }
  if (typeof part === 'string') {
    return part;
  }
  if (Array.isArray(part)) {
    return part.map(decodeAIV5ContentPart).join('');
  }
  return '';
};

const decodeAIV5ContentPart = (part: UIMessagePart<any, any> | undefined) => {
  if (!part) {
    return '';
  }
  switch (part.type) {
    case 'text':
      return part.text;
    case 'file':
      return part.filename;
    case 'dynamic-tool':
      return part.toolName;
    case 'reasoning':
      return part.text;
    case 'source-url':
      return part.url;
    default:
      return part.type;
  }
};
