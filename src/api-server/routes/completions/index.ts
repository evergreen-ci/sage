import express, { type IRouter } from 'express';
import lumberRouter from './lumber';
import mementoRouter from './memento';
import parsleyOrchestratorRouter from './parsley';
import releaseNotesRouter from './releaseNotes';

const completionsRouter: IRouter = express.Router();

completionsRouter.use('/parsley/conversations', parsleyOrchestratorRouter);
completionsRouter.use('/memento', mementoRouter);
completionsRouter.use('/lumber', lumberRouter);
completionsRouter.use('/release-notes', releaseNotesRouter);

export default completionsRouter;
