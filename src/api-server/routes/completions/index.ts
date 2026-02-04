import express from 'express';
import lumberRouter from './lumber';
import mementoRouter from './memento';
import parsleyOrchestratorRouter from './parsley';
import releaseNotesRouter from './releaseNotes';

// export express router
const completionsRouter = express.Router();

completionsRouter.use('/parsley/conversations', parsleyOrchestratorRouter);
completionsRouter.use('/memento', mementoRouter);
completionsRouter.use('/lumber', lumberRouter);
completionsRouter.use('/release-notes', releaseNotesRouter);

export default completionsRouter;
