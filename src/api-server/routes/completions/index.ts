import express from 'express';
import parsleyRouter from './parsley';

// export express router
const completionsRouter = express.Router();

completionsRouter.use('/parsley', parsleyRouter);

export default completionsRouter;
