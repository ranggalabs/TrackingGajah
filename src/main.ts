import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as basicAuth from 'express-basic-auth';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;
  const prefix = configService.get<string>('APP_PREFIX') || 'v1';

  // Enable CORS
  app.enableCors();

  // Global Prefix
  app.setGlobalPrefix(prefix);

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger Documentation with Basic Auth
  const swaggerUser = configService.get<string>('SWAGGER_USER') || 'admin';
  const swaggerPass = configService.get<string>('SWAGGER_PASSWORD') || 'admin123';

  app.use(
    [`/${prefix}/docs`, `/${prefix}/docs-json`],
    basicAuth({
      challenge: true,
      users: { [swaggerUser]: swaggerPass },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Elephant Tracking System API (GT02A)')
    .setDescription(
      'REST API backend untuk pelacakan gajah menggunakan perangkat GPS Tracker GT02A berdasarkan standar LSKK',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${prefix}/docs`, app, document);

  await app.listen(port);
  logger.log(`🐘 Backend Elephant Tracking berjalan pada: http://localhost:${port}/${prefix}`);
  logger.log(`📖 Swagger API Docs: http://localhost:${port}/${prefix}/docs`);
}
bootstrap();
