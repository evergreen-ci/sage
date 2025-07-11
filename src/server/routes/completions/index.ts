import express from 'express';
import parsleyCompletionsRoute from './parsley';

// export express router
const router = express.Router();

router.post('/parsley', parsleyCompletionsRoute);

export default router;
