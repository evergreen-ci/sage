import { Request, Response } from 'express';

const rootRoute = (req: Request, res: Response) => {
  res.json({ message: 'Welcome to Sage - Evergreen AI Service' });
};

export default rootRoute;
