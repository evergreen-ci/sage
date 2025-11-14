import express from 'express';
import mementoRouter from './memento';
import parsleyOrchestratorRouter from './parsley';

// export express router
const completionsRouter = express.Router();

completionsRouter.use('/parsley/conversations', parsleyOrchestratorRouter);
completionsRouter.use('/memento', mementoRouter);

export default completionsRouter;
