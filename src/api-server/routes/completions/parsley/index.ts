import express from 'express';
import chatRoute from './chat';
import getMessagesRoute from './getMessages';

const parsleyOrchestratorRouter = Router();

// Route to initiate a chat stream
parsleyOrchestratorRouter.post('/chat', chatRoute);
parsleyOrchestratorRouter.get('/:conversationId/messages', getMessagesRoute);

export default parsleyOrchestratorRouter;
