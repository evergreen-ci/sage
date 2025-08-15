import { Router } from 'express';
import addMessageRoute from './addMessage';
import getMessagesRoute from './getMessages';

const sageOrchestratorRouter = Router();

sageOrchestratorRouter.post('/:conversationId/messages', addMessageRoute);
sageOrchestratorRouter.get('/:conversationId/messages', getMessagesRoute);

export default sageOrchestratorRouter;
