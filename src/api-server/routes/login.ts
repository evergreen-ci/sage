import { Request, Response } from 'express';

/**
 * Login route This route primarily serves to provide a success message to the client after a successful login
 * Login is handled by the kanopy oidc login flow and a user will be redirected to this route after a successful login
 * @param req - Express request object
 * @param res - Express response object
 */
const loginRoute = (req: Request, res: Response) => {
  res.send({ message: 'Logged in successfully, you may close this window' });
};

export default loginRoute;
