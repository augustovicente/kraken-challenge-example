import 'dotenv/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

/**
 * Constants.
 */

const port = process.env.PORT || 3000;

/**
 * Bootstrap function.
 */

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for dashboard.
  app.enableCors();

  // Global prefix.
  app.setGlobalPrefix('api');

  await app.listen(port);

  console.log(`running on: http://localhost:${port}/api`);
}

bootstrap();
