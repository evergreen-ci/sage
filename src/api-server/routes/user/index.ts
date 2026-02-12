import express, { type IRouter } from 'express';
import {
  getCursorKeyRoute,
  upsertCursorKeyRoute,
  deleteCursorKeyRoute,
} from './cursorKey';

const userRouter: IRouter = express.Router();

userRouter.get('/cursor-key', getCursorKeyRoute);
userRouter.post('/cursor-key', upsertCursorKeyRoute);
userRouter.delete('/cursor-key', deleteCursorKeyRoute);

export default userRouter;
