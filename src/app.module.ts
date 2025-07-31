import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ProfilingController } from './profiling/mem-profiling.controller';
import { MemoryProfilingService } from './profiling/mem-profiling.service';
import { MemoryTrackingInterceptor } from './profiling/mem.interceptor';
import { PrometheusMetricsService } from './profiling/prom-metrics.service';
import { MemoryStressController } from './profiling/mem-stress-test.controller';

@Module({
  providers: [
    MemoryProfilingService,
    PrometheusMetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MemoryTrackingInterceptor,
    },
  ],
  controllers: [ProfilingController, MemoryStressController],
  exports: [MemoryProfilingService, PrometheusMetricsService],
})
export class AppModule {}
