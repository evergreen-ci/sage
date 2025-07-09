import { Request, Response } from 'express';

const parsleyCompletionsRoute = (req: Request, res: Response) => {
  //  TODO: Implement the completions route
  res.json({ message: 'Parsley Completions route' });
};

export default parsleyCompletionsRoute;
