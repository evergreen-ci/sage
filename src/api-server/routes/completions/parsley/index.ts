import express from 'express';
import addMessageRoute from './addMessage';
import createConversationRoute from './createConversation';
import getMessagesRoute from './getMessages';

// export express router
const router = express.Router();

export type AddMessageOutput = {
  message: string;
  requestId: string;
  timestamp: string;
  completionUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  conversationId: string;
};

export type ErrorResponse = {
  message: string;
};

// Route to add a conversation and get a response
router.post('/messages', createConversationRoute);

// Route to add a new message to a conversation and get a response
router.post('/:conversationId/messages', addMessageRoute);

// Route to get messages for a conversation
router.get('/:conversationId/messages', getMessagesRoute);

export default router;
