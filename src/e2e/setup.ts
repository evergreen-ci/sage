import sageServer from '../api-server';

const setupTestAppServer = () => {
  const app = sageServer.getApp();
  return app;
};

export default setupTestAppServer;
