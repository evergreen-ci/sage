import express from 'express';
import cursorKeyRouter from './cursorKey';

const userRouter = express.Router();

userRouter.use('/', cursorKeyRouter);

export default userRouter;
