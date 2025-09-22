import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MemoryProfilingService } from './mem-profiling.service';
import { PrometheusMetricsService } from './prom-metrics.service';

@Injectable()
export class MemoryTrackingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MemoryTrackingInterceptor.name);

  constructor(
    private readonly memoryProfilingService: MemoryProfilingService,
    private readonly prometheusMetricsService: PrometheusMetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const startTime = Date.now();
    const startMemory = this.memoryProfilingService.getMemoryUsage();

    (request as any).startMemory = startMemory;
    (request as any).startTime = startTime;

    if (request.url.includes('sse') && !(request as any)?.id) {
      (request as any).id = this.generateRandomString(16);
    }

    return next.handle().pipe(
      tap(() => {
        const endTime = Date.now();
        const endMemory = this.memoryProfilingService.getMemoryUsage();
        const duration = endTime - startTime;

        const memoryDelta = {
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          rss: endMemory.rss - startMemory.rss,
          external: endMemory.external - startMemory.external,
        };

        const responseSize =
          response.get('content-length') ||
          Buffer.byteLength(JSON.stringify(response.locals || '{}'));

        const requestInfo = {
          method: request.method,
          url: request.url,
          userAgent: request.headers['user-agent'],
          ip: request.ip,
          duration,
          statusCode: response.statusCode,
          memoryBefore: startMemory,
          memoryAfter: endMemory,
          memoryDelta,
          timestamp: new Date().toISOString(),
          responseSize,
        };

        if (
          (Math.abs(memoryDelta.heapUsed) > 10 || duration > 5000) &&
          !requestInfo.url.includes('sse')
        ) {
          this.logger.warn('High memory/slow request detected', requestInfo);
        }

        this.emitMetrics(requestInfo);
      }),
    );
  }

  private emitMetrics(requestInfo: any) {
    this.prometheusMetricsService.recordHttpRequest(
      requestInfo.method,
      this.normalizeRoute(requestInfo.url),
      requestInfo.statusCode,
      requestInfo.duration / 1000,
      requestInfo.memoryDelta.heapUsed,
      requestInfo?.responseSize ? Number(requestInfo?.responseSize) : 0,
    );

    this.prometheusMetricsService.recordEndpointMemory(
      requestInfo.method,
      this.normalizeRoute(requestInfo.url),
      requestInfo.memoryAfter.heapUsed,
      requestInfo.memoryDelta.heapUsed,
    );
  }

  private normalizeRoute(url: string): string {
    return url
      .replace(/\/\d+/g, '/:id')
      .replace(/\?.*/, '')
      .split('/')
      .slice(0, 4)
      .join('/');
  }

  private generateRandomString(length) {
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }
    return result;
  }
}

export function memoryTrackingMiddleware(req: any, res: any, next: any) {
  const startMemory = process.memoryUsage();
  const startTime = Date.now();

  req.startMemory = startMemory;
  req.startTime = startTime;

  res.on('finish', () => {
    const endMemory = process.memoryUsage();
    const duration = Date.now() - startTime;

    const memoryDelta = {
      rss: Math.round((endMemory.rss - startMemory.rss) / 1024 / 1024),
      heapUsed: Math.round(
        (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024,
      ),
      heapTotal: Math.round(
        (endMemory.heapTotal - startMemory.heapTotal) / 1024 / 1024,
      ),
    };

    if (Math.abs(memoryDelta.heapUsed) > 5) {
      console.log(`Memory delta for ${req.method} ${req.url}:`, {
        duration,
        memoryDelta,
        statusCode: res.statusCode,
      });
    }
  });

  next();
}
