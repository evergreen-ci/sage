import express from 'express';
import parsleyNetworkRouter from './parsley';

// export express router
const completionsRouter = express.Router();

completionsRouter.use('/parsley/conversations', parsleyNetworkRouter);

export default completionsRouter;
