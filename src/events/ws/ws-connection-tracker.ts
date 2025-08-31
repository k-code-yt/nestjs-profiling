import { Logger } from '@nestjs/common';
import { MemoryProfilingService } from '../../profiling/mem-profiling.service';
import { PrometheusMetricsService } from '../../profiling/prom-metrics.service';

export class WSConnectionTracker {
  private readonly logger = new Logger('WSConnectionTracker');

  constructor(
    private readonly memoryProfilingService: MemoryProfilingService,
    private readonly prometheusMetricsService: PrometheusMetricsService,
  ) {}

  trackConnection(event: 'connect' | 'disconnect', client: any) {
    const currentMemory = this.memoryProfilingService.getMemoryUsage();
    const currentMemoryMB = currentMemory.heapUsed / 1024 / 1024;

    this.logger.log(
      `WS ${event}: ${client?.id || 'unknown'} - Memory: ${currentMemoryMB.toFixed(2)}MB`,
    );

    this.prometheusMetricsService.recordWebSocketConnection(
      event,
      client?.id || 'unknown',
      currentMemoryMB,
    );
  }
}
