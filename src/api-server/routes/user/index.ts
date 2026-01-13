import express from 'express';
import {
  getCursorKeyRoute,
  upsertCursorKeyRoute,
  deleteCursorKeyRoute,
} from './cursorKey';

const userRouter = express.Router();

userRouter.get('/cursor-key', getCursorKeyRoute);
userRouter.post('/cursor-key', upsertCursorKeyRoute);
userRouter.delete('/cursor-key', deleteCursorKeyRoute);

export default userRouter;
