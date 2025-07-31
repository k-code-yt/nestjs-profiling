import { Controller, Get, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { MemoryProfilingService } from './mem-profiling.service';
import { PrometheusMetricsService } from './prom-metrics.service';

@Controller('profiling')
export class ProfilingController {
  private cpuProfilingSessions = new Map<string, any>();

  constructor(
    private readonly memoryProfilingService: MemoryProfilingService,
    private readonly prometheusMetrics: PrometheusMetricsService,
  ) {}

  @Get('memory')
  getMemoryUsage() {
    return {
      status: 'success',
      data: this.memoryProfilingService.getMemoryUsage(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('heap-snapshot')
  takeHeapSnapshot(@Query('filename') filename?: string) {
    const snapshotPath = this.memoryProfilingService.takeHeapSnapshot(filename);
    return {
      status: 'success',
      message: 'Heap snapshot created',
      path: snapshotPath,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('cpu-profile/start')
  startCPUProfiling(@Query('sessionId') sessionId: string = 'default') {
    if (this.cpuProfilingSessions.has(sessionId)) {
      return {
        status: 'error',
        message: `CPU profiling session '${sessionId}' already active`,
      };
    }

    const session = this.memoryProfilingService.startCPUProfiling();
    this.cpuProfilingSessions.set(sessionId, session);

    return {
      status: 'success',
      message: `CPU profiling started for session '${sessionId}'`,
      sessionId,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('cpu-profile/stop')
  async stopCPUProfiling(
    @Query('sessionId') sessionId: string = 'default',
    @Query('filename') filename?: string,
  ) {
    const session = this.cpuProfilingSessions.get(sessionId);
    if (!session) {
      return {
        status: 'error',
        message: `No active CPU profiling session found for '${sessionId}'`,
      };
    }

    try {
      const profilePath = await this.memoryProfilingService.stopCPUProfiling(
        session,
        filename,
      );
      this.cpuProfilingSessions.delete(sessionId);

      return {
        status: 'success',
        message: 'CPU profiling stopped',
        path: profilePath,
        sessionId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Failed to stop CPU profiling',
        error: error.message,
      };
    }
  }

  @Post('gc')
  forceGarbageCollection() {
    const result = this.memoryProfilingService.forceGarbageCollection();

    if (result) {
      return {
        status: 'success',
        message: 'Garbage collection completed',
        memoryFreed: result.before.heapUsed - result.after.heapUsed,
        before: result.before,
        after: result.after,
        timestamp: new Date().toISOString(),
      };
    } else {
      return {
        status: 'error',
        message:
          'Garbage collection not available. Start with --expose-gc flag',
      };
    }
  }

  @Get('metrics')
  async getPrometheusMetrics(@Res() response: Response) {
    const metrics = await this.prometheusMetrics.getMetrics();
    response.set('Content-Type', 'text/plain');
    response.send(metrics);
  }

  @Get('health')
  getHealthStatus() {
    const memory = this.memoryProfilingService.getMemoryUsage();
    const heapUsagePercent = (memory.heapUsed / memory.heapSizeLimit) * 100;

    const status =
      heapUsagePercent > 90
        ? 'critical'
        : heapUsagePercent > 75
          ? 'warning'
          : 'healthy';

    return {
      status,
      memory,
      heapUsagePercent: Math.round(heapUsagePercent * 100) / 100,
      activeSessions: Array.from(this.cpuProfilingSessions.keys()),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('monitoring/start')
  startMemoryMonitoring(
    @Query('interval') interval: string = '30000',
    @Query('threshold') threshold: string = '80',
  ) {
    const intervalMs = parseInt(interval, 10);
    const thresholdPercent = parseInt(threshold, 10);

    this.memoryProfilingService.startMemoryMonitoring(
      intervalMs,
      thresholdPercent,
    );

    return {
      status: 'success',
      message: 'Memory monitoring started',
      interval: intervalMs,
      threshold: thresholdPercent,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('test-req-time')
  runTest() {
    const iterations = 1000000;
    const start = new Date().getTime();
    console.time('without-interceptor');
    for (let i = 0; i < iterations; i++) {
      const response = { data: 'test' };
    }
    console.timeEnd('without-interceptor');
    const end = new Date().getTime();
    return {
      status: 'success',
      diff: `${end - start} ms`,
    };
  }
}
