import express from 'express';
import parsleyOrchestratorRouter from './parsley';

// export express router
const completionsRouter = express.Router();

completionsRouter.use('/parsley/conversations', parsleyOrchestratorRouter);

export default completionsRouter;
