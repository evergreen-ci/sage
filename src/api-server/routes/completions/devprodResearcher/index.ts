import express, { type IRouter } from 'express';
import chatRoute from './chat';

const devprodResearcherRouter: IRouter = express.Router();

devprodResearcherRouter.post('/chat', chatRoute);

export default devprodResearcherRouter;
