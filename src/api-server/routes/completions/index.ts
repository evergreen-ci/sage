import express from 'express';
import parsleyRouter from './parsley';

// export express router
const completionsRouter = express.Router();

completionsRouter.use('/parsley/conversations', parsleyRouter);

export default completionsRouter;
