import { Injectable, Logger } from '@nestjs/common';
import {
  register,
  collectDefaultMetrics,
  Histogram,
  Gauge,
  Counter,
} from 'prom-client';

@Injectable()
export class PrometheusMetricsService {
  private readonly httpRequestDuration: Histogram<string>;
  private readonly httpRequestsTotal: Counter<string>;
  private readonly memoryUsageGauge: Gauge<string>;
  private readonly heapUsedGauge: Gauge<string>;
  private readonly memoryDeltaHistogram: Histogram<string>;
  private readonly activeConnectionsGauge: Gauge<string>;

  private readonly endpointMemoryGauge: Gauge<string>;
  private readonly endpointMemoryDeltaHistogram: Histogram<string>;

  constructor() {
    // Collect default Node.js metrics
    collectDefaultMetrics({ register });

    // HTTP request duration histogram
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    });

    // HTTP requests total counter
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    // Memory usage gauge
    this.memoryUsageGauge = new Gauge({
      name: 'nodejs_memory_usage_bytes',
      help: 'Node.js memory usage in bytes',
      labelNames: ['type'],
    });

    // Heap used gauge
    this.heapUsedGauge = new Gauge({
      name: 'nodejs_heap_used_bytes',
      help: 'Node.js heap used in bytes',
    });

    // Memory delta histogram per request
    this.memoryDeltaHistogram = new Histogram({
      name: 'http_request_memory_delta_mb',
      help: 'Memory delta per HTTP request in MB',
      labelNames: ['method', 'route'],
      buckets: [-50, -10, -5, -1, 0, 1, 5, 10, 25, 50, 100],
    });

    // Active connections gauge
    this.activeConnectionsGauge = new Gauge({
      name: 'nodejs_active_connections',
      help: 'Number of active connections',
    });

    // Endpoint-specific memory usage
    this.endpointMemoryGauge = new Gauge({
      name: 'http_endpoint_memory_usage_mb',
      help: 'Memory usage per endpoint in MB',
      labelNames: ['method', 'route'],
    });

    // Endpoint memory delta histogram
    this.endpointMemoryDeltaHistogram = new Histogram({
      name: 'http_endpoint_memory_delta_mb',
      help: 'Memory delta per endpoint in MB',
      labelNames: ['method', 'route'],
      buckets: [-20, -10, -5, -1, 0, 1, 5, 10, 20, 50],
    });

    // Start periodic memory collection
    this.startMemoryCollection();
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
    memoryDeltaMB: number,
  ) {
    const labels = { method, route, status_code: statusCode.toString() };

    this.httpRequestDuration.observe(labels, durationSeconds);
    this.httpRequestsTotal.inc(labels);
    this.memoryDeltaHistogram.observe({ method, route }, memoryDeltaMB);
  }

  /**
   * Update memory metrics
   */
  updateMemoryMetrics() {
    const memUsage = process.memoryUsage();

    this.memoryUsageGauge.set({ type: 'rss' }, memUsage.rss);
    this.memoryUsageGauge.set({ type: 'heap_used' }, memUsage.heapUsed);
    this.memoryUsageGauge.set({ type: 'heap_total' }, memUsage.heapTotal);
    this.memoryUsageGauge.set({ type: 'external' }, memUsage.external);
    this.memoryUsageGauge.set({ type: 'array_buffers' }, memUsage.arrayBuffers);

    this.heapUsedGauge.set(memUsage.heapUsed);
    Logger.log('', 'updateMemoryMetrics');
  }

  /**
   * Set active connections count
   */
  setActiveConnections(count: number) {
    this.activeConnectionsGauge.set(count);
  }

  /**
   * Get metrics for Prometheus scraping
   */
  async getMetrics(): Promise<string> {
    this.updateMemoryMetrics();
    return register.metrics();
  }

  /**
   * Start periodic memory collection
   */
  private startMemoryCollection() {
    setInterval(() => {
      this.updateMemoryMetrics();
    }, 10000); // Every 10 seconds
  }

  /**
   * Record endpoint-specific memory usage
   */
  recordEndpointMemory(
    method: string,
    route: string,
    memoryUsedMB: number,
    memoryDeltaMB: number,
  ) {
    const labels = { method, route };

    this.endpointMemoryGauge.set(labels, memoryUsedMB);
    this.endpointMemoryDeltaHistogram.observe(labels, memoryDeltaMB);
  }

  /**
   * Create custom gauge
   */
  createGauge(name: string, help: string, labelNames?: string[]) {
    return new Gauge({
      name,
      help,
      labelNames,
    });
  }

  /**
   * Create custom histogram
   */
  createHistogram(
    name: string,
    help: string,
    labelNames?: string[],
    buckets?: number[],
  ) {
    return new Histogram({
      name,
      help,
      labelNames,
      buckets,
    });
  }

  /**
   * Create custom counter
   */
  createCounter(name: string, help: string, labelNames?: string[]) {
    return new Counter({
      name,
      help,
      labelNames,
    });
  }
}
