import { Global, Module } from '@nestjs/common';
import { MemoryProfilingService } from './mem-profiling.service';
import { PrometheusMetricsService } from './prom-metrics.service';
import { ProfilingController } from './mem-profiling.controller';
import { MemoryStressController } from './mem-stress-test.controller';

@Global()
@Module({
  providers: [MemoryProfilingService, PrometheusMetricsService],
  controllers: [ProfilingController, MemoryStressController],
  exports: [MemoryProfilingService, PrometheusMetricsService],
})
export class MemoryModule {}
