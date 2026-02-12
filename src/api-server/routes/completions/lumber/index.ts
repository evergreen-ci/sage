import express, { type IRouter } from 'express';
import questionOwnershipRoute from './questionOwnership';

const lumberRouter: IRouter = express.Router();
lumberRouter.post('/determine-owner', questionOwnershipRoute);
export default lumberRouter;
