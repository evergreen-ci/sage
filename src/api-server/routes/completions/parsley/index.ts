import express from 'express';
import addMessageRoute from './addMessage';
import getMessagesRoute from './getMessages';

// export express router
const router = express.Router();

// Route to add a new message to a conversation and get a response
router.post('/:conversationId/messages', addMessageRoute);

// Route to get messages for a conversation
router.get('/:conversationId/messages', getMessagesRoute);

export default router;
