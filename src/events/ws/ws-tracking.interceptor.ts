import {
  Injectable,
  Logger,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MemoryProfilingService } from '../../profiling/mem-profiling.service';
import { PrometheusMetricsService } from '../../profiling/prom-metrics.service';

// TODOs
// cancel SSE intervals
// cancel WS intervals

// add k8s && nginx w/ HTTP2
// add scalling up/down and test re-connections
@Injectable()
export class WSMemoryTrackingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('WSMemoryTracker');

  constructor(
    private readonly memoryProfilingService: MemoryProfilingService,
    private readonly prometheusMetricsService: PrometheusMetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const wsContext = context.switchToWs();
    const client = wsContext.getClient();
    const data = wsContext.getData();
    const handler = context.getHandler();

    const startTime = Date.now();
    const startMemory = this.memoryProfilingService.getMemoryUsage();

    return next.handle().pipe(
      tap(() => {
        const endTime = Date.now();
        const endMemory = this.memoryProfilingService.getMemoryUsage();
        const duration = (endTime - startTime) / 1000;
        const memoryDeltaBytes = endMemory.heapUsed - startMemory.heapUsed;
        const memoryDeltaMB = memoryDeltaBytes / 1024 / 1024;
        const currentMemoryMB = endMemory.heapUsed / 1024 / 1024;

        const eventName = handler.name || 'unknown';

        if (Math.abs(memoryDeltaMB) > 200 || duration > 1) {
          this.logger.warn(`WS ${eventName} memory usage:`, {
            event: eventName,
            duration,
            memoryDeltaMB: Math.round(memoryDeltaMB) + 'MB',
            clientId: client?.id || 'unknown',
            dataSize: JSON.stringify(data || {}).length,
          });
        }

        this.prometheusMetricsService.recordWebSocketMessage(
          eventName,
          memoryDeltaMB,
          duration,
          currentMemoryMB,
        );
      }),
    );
  }
}
