import express from 'express';
import addMessageRoute from './addMessage';
import createConversationRoute from './createConversation';
import getMessagesRoute from './getMessages';

// export express router
const router = express.Router();

// Route to create a new conversation
router.post('/', createConversationRoute);

// Route to add a new message to a conversation and get a response
router.post('/:conversationId/messages', addMessageRoute);

// Route to get messages for a conversation
router.get('/:conversationId', getMessagesRoute);

export default router;
