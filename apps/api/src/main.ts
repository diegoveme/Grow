import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  const swagger = new DocumentBuilder()
    .setTitle('Raíz API')
    .setDescription('Stellar anchor (SEP-10/24), remittance splits and yield vault orchestration')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  // Railway/Render inject PORT and require the app to bind to it; fall back to
  // API_PORT for local dev.
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`🌱 Raíz API listening on port ${port} (/api)`);
}
bootstrap();
