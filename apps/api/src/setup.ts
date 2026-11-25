import { INestApplication, ValidationPipe } from '@nestjs/common';

/** Global prefix + validation shared by the server and the e2e tests. */
export function configureApp(app: INestApplication): void {
  // Behind Railway/Vercel proxies, trust the first hop so req.ip is the client
  // (the rate limiter keys on it).
  const http = app.getHttpAdapter().getInstance() as { set?: (k: string, v: unknown) => void };
  http.set?.('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
}
