import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.enableShutdownHooks();

  process.on('warning', (warning) => {
    console.warn('Process Warning:', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
    });
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);

    const v8 = require('v8');
    const fs = require('fs');
    const snapshot = v8.getHeapSnapshot();
    const fileStream = fs.createWriteStream(
      `emergency-heap-${Date.now()}.heapsnapshot`,
    );
    snapshot.pipe(fileStream);

    setTimeout(() => process.exit(1), 5000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

// HIGH LOAD
// connectionCount: 1000,
//   messagesPerMinute: 60,
//   durationSeconds: 120

// Medium Load
//   connectionCount: 500,
//   messagesPerMinute: 30,
//   durationSeconds: 300

// Low Load
// connectionCount: 100,
//   messagesPerMinute: 10,
//   durationSeconds: 600
