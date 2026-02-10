import express, { type IRouter } from 'express';
import summarizeThreadRoute from './summarizeThread';

const mementoRouter: IRouter = express.Router();

mementoRouter.post('/summarize-thread', summarizeThreadRoute);

export default mementoRouter;
