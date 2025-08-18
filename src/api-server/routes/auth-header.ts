import { Request, Response } from 'express';

const authHeaderRoute = (req: Request, res: Response) => {
  const authHeader = req.headers['x-kanopy-internal-authorization'];
  const userHeader = req.headers['"X-Kanopy-Authorization"'];

  res.json({
    'x-kanopy-internal-authorization': authHeader || null,
    'x-kanopy-authorization': userHeader || null,
    restHeaders: req.headers,
  });
};

export default authHeaderRoute;
