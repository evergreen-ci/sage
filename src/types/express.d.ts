// types/express.d.ts
import '@types/express';

declare module '@types/express' {
  interface Response {
    locals: {
      userId?: string;
      requestId?: string;
      startTime?: number;
    };
  }
}
