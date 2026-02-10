import { Request, Response } from 'express';

const helloWorldRoute = (req: Request, res: Response) => {
  res.json({ message: 'hello, world' });
};

export default helloWorldRoute;
