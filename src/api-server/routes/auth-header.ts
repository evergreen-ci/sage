import { Request, Response } from 'express';

const authHeaderRoute = (req: Request, res: Response) => {
  const authHeader = req.headers['x-kanopy-internal-authorization'];
  const userHeader = req.headers['"X-Kanopy-Authorization"'];

  res.json({
    'X-Kanopy-Internal-Authorization': authHeader || null,
    'X-Kanopy-Authorization': userHeader || null,
    restHeaders: req.headers,
  });
};

export default authHeaderRoute;
