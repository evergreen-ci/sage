import express from 'express';
import sageOrchestratorRouter from './parsley';

// export express router
const completionsRouter = express.Router();

completionsRouter.use('/parsley/conversations', sageOrchestratorRouter);

export default completionsRouter;
