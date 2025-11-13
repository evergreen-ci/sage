import express from 'express';
import summarizeThreadRoute from './summarizeThread';

const mementoRouter = express.Router();

// Route to generate structured summary from Slack thread capture
mementoRouter.post('/summarize-thread', summarizeThreadRoute);

export default mementoRouter;
