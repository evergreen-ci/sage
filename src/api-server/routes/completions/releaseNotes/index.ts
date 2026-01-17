import express from 'express';
import generateReleaseNotesRoute from './generate';

const releaseNotesRouter = express.Router();

// Apply higher payload limit (10MB) specifically for release notes endpoint
// This is needed to support large issue lists, but we don't want to expose
// all routes to potential payload-based attacks
releaseNotesRouter.use(
  express.json({ limit: '10mb' }),
  express.urlencoded({ extended: true, limit: '10mb' })
);

releaseNotesRouter.post('/generate', generateReleaseNotesRoute);

export default releaseNotesRouter;
