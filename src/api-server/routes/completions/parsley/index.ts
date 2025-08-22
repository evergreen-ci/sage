import express from 'express';
import chatRoute from './chat';
import getMessagesRoute from './getMessages';

// export express router
const router = express.Router();

// Route to initiate a chat stream
router.post('/chat', chatRoute);

// Route to get messages for a conversation
router.get('/:conversationId/messages', getMessagesRoute);

export default router;
