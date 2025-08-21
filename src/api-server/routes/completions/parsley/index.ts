import { Router } from 'express';
import addMessageRoute from './addMessage';
import getMessagesRoute from './getMessages';

const parsleyOrchestratorRouter = Router();

parsleyOrchestratorRouter.post('/:conversationId/messages', addMessageRoute);
parsleyOrchestratorRouter.get('/:conversationId/messages', getMessagesRoute);

export default parsleyOrchestratorRouter;
