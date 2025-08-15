import { Router } from 'express';
import addMessageRoute from './addMessage';
import getMessagesRoute from './getMessages';

const parsleyNetworkRouter = Router();

parsleyNetworkRouter.post('/:conversationId/messages', addMessageRoute);
parsleyNetworkRouter.get('/:conversationId/messages', getMessagesRoute);

export default parsleyNetworkRouter;
