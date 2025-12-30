import express from 'express';
import questionOwnershipRoute from './questionOwnership';
import questionOwnershipWithEmbeddingsRoute from './questionOwnershipWithEmbeddings';
import upsertQuestionOwnershipWithEmbeddingsRoute from './upsertQuestionOwnershipWithEmbeddings';

const lumberRouter = express.Router();
lumberRouter.post('/determine-owner', questionOwnershipRoute);
lumberRouter.post(
  '/determine-owner-with-embeddings',
  questionOwnershipWithEmbeddingsRoute
);
lumberRouter.post(
  '/upsert-owner-with-embeddings',
  upsertQuestionOwnershipWithEmbeddingsRoute
);
export default lumberRouter;
