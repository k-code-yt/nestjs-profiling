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
// 1.add tracking for WS conn
// check why WS mem not working

// 2.add load-testing for each

// 3.add k8s && nginx w/ HTTP2
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
        const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

        const eventName = handler.name || 'unknown';

        this.logger.debug(`WS end mem delta: ${memoryDelta / 1024 / 1024}`);

        if (Math.abs(memoryDelta) > 1048576 || duration > 1) {
          this.logger.warn(`WS ${eventName} memory usage:`, {
            event: eventName,
            duration,
            memoryDelta: Math.round(memoryDelta / 1024) + 'KB',
            clientId: client?.id || 'unknown',
            dataSize: JSON.stringify(data || {}).length,
          });
        }

        this.prometheusMetricsService.recordWebSocketMessage(
          eventName,
          memoryDelta,
          duration,
        );
      }),
    );
  }
}
