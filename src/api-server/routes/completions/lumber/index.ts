import express from 'express';
import questionOwnershipRoute from './questionOwnership';

const lumberRouter = express.Router();
lumberRouter.post('/determine-owner', questionOwnershipRoute);
export default lumberRouter;
