import express from 'express';
import generateReleaseNotesRoute from './generate';

const releaseNotesRouter = express.Router();

releaseNotesRouter.post('/generate', generateReleaseNotesRoute);

export default releaseNotesRouter;
