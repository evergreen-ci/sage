import { Request, Response } from 'express';

const authHeaderRoute = (req: Request, res: Response) => {
  const authHeader = req.headers['x-kanopy-internal-authorization'];

  res.json({
    'X-Kanopy-Internal-Authorization': authHeader || null,
  });
};

export default authHeaderRoute;
