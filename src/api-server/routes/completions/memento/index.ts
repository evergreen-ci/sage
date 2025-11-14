import express from 'express';
import summarizeThreadRoute from './summarizeThread';

const mementoRouter = express.Router();

mementoRouter.post('/summarize-thread', summarizeThreadRoute);

export default mementoRouter;
