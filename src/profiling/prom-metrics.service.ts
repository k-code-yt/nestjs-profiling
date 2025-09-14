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
  private readonly sseConnectionsTotal: Counter<string>;

  private readonly endpointMemoryGauge: Gauge<string>;
  private readonly endpointMemoryDeltaHistogram: Histogram<string>;

  private readonly wsConnectionsTotal: Counter<string>;
  private readonly wsMemoryUsage: Gauge<string>;
  private readonly wsMessageCounter: Counter<string>;
  private readonly wsMemoryDelta: Histogram<string>;
  private readonly wsMessageDuration: Histogram<string>;

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

    this.sseConnectionsTotal = new Counter({
      name: 'sse_connections_total',
      help: 'Total SSE connections',
      labelNames: ['event', 'client_id'],
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

    this.wsConnectionsTotal = new Counter({
      name: 'websocket_connections_total',
      help: 'Total WebSocket connections',
      labelNames: ['event', 'client_id'],
    });

    this.wsMemoryUsage = new Gauge({
      name: 'websocket_memory_usage_mb',
      help: 'Current memory usage during WebSocket operations',
      labelNames: ['event'],
    });

    this.wsMessageCounter = new Counter({
      name: 'websocket_messages_total',
      help: 'Total WebSocket messages processed',
      labelNames: ['event'],
    });

    this.wsMemoryDelta = new Histogram({
      name: 'websocket_memory_delta_mb',
      help: 'Memory delta per WebSocket message',
      labelNames: ['event'],
      buckets: [-4, -2, -1, -0.5, -0.25, 0, 0.25, 0.5, 1, 2, 4, 8],
    });

    this.wsMessageDuration = new Histogram({
      name: 'websocket_message_duration_seconds',
      help: 'WebSocket message processing duration',
      labelNames: ['event'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
    });
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
    // Logger.log('', 'updateMemoryMetrics');
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

  recordSSEConnection(event: 'connect' | 'disconnect', clientId: string) {
    this.sseConnectionsTotal.inc({
      event,
      client_id: clientId.substring(0, 8),
    });
  }

  recordWebSocketConnection(
    event: 'connect' | 'disconnect',
    clientId: string,
    memoryUsed: number,
  ) {
    this.wsConnectionsTotal.inc({ event, client_id: clientId.substring(0, 8) });
    this.wsMemoryUsage.set({ event }, memoryUsed);
  }

  recordWebSocketMessage(
    event: string,
    memoryDelta: number,
    duration: number,
    currentMemoryMB: number,
  ): void {
    this.wsMessageCounter.inc({ event });
    this.wsMemoryDelta.observe({ event }, memoryDelta);
    this.wsMemoryUsage.set({ event }, currentMemoryMB);
    this.wsMessageDuration.observe({ event }, duration);
    // Logger.debug(`recording WS for event: ${event}`);
  }
}
