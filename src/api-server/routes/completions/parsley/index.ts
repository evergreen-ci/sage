import express, { type IRouter } from 'express';
import chatRoute from './chat';
import getMessagesRoute from './getMessages';
import rateMessageRoute from './rateMessage';

const parsleyOrchestratorRouter: IRouter = express.Router();

// Route to initiate a chat stream
parsleyOrchestratorRouter.post('/chat', chatRoute);
parsleyOrchestratorRouter.post('/rate', rateMessageRoute);
parsleyOrchestratorRouter.get('/:conversationId/messages', getMessagesRoute);

export default parsleyOrchestratorRouter;
