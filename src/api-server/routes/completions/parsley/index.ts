import express from 'express';
import chatRoute from './chat';
import getMessagesRoute from './getMessages';
import rateMessageRoute from './rateMessage';

const parsleyOrchestratorRouter = express.Router();

// Route to initiate a chat stream
parsleyOrchestratorRouter.post('/chat', chatRoute);
parsleyOrchestratorRouter.get('/:conversationId/messages', getMessagesRoute);
parsleyOrchestratorRouter.post('/messages/:messageId/rating', rateMessageRoute);

export default parsleyOrchestratorRouter;
