import { NestApplication, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as compression from 'compression';
import { constants } from 'zlib';
import { INestApplication } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.enableShutdownHooks();

  //   addCompressionMiddleware(app)

  process.on('warning', (warning) => {
    console.warn('Process Warning:', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
    });
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    setTimeout(() => process.exit(1), 5000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  await app.listen(process.env.PORT ?? 3000);
}

function addCompressionMiddleware(app: INestApplication) {
  app.use(
    compression({
      filter: (req, res) => {
        return req.headers.accept?.includes('text/event-stream') || false;
      },
      level: 4,
      flush: constants.Z_SYNC_FLUSH,
      //   brotli: {
      //     flush: constants.BROTLI_OPERATION_FLUSH,
      //     finishFlush: constants.BROTLI_OPERATION_FINISH,
      //     chunkSize: 12 * 1024,
      //     params: {
      //       [constants.BROTLI_PARAM_QUALITY]: 2,
      //       [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
      //     },
      //   },
      //   zlib: {
      //     flush: constants.Z_SYNC_FLUSH,
      //   },
    }),
  );
}

bootstrap();
