import { Injectable } from '@nestjs/common';
import {
  register,
  collectDefaultMetrics,
  Histogram,
  Gauge,
  Counter,
} from 'prom-client';

@Injectable()
export class PrometheusMetricsService {
  // Memory metrics
  private readonly memoryUsageGauge: Gauge<string>;
  private readonly heapUsedGauge: Gauge<string>;
  private readonly memoryDeltaHistogram: Histogram<string>;
  private readonly activeConnectionsGauge: Gauge<string>;

  private readonly endpointMemoryGauge: Gauge<string>;
  private readonly endpointMemoryDeltaHistogram: Histogram<string>;

  private readonly wsMemoryUsage: Gauge<string>;
  private readonly wsMessageCounter: Counter<string>;
  private readonly wsMemoryDelta: Histogram<string>;
  private readonly wsMessageDuration: Histogram<string>;

  // HTTP metrics
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;
  private readonly httpResponseSizeBytes: Histogram<string>;

  // Connection metrics
  private readonly sseConnectionsTotal: Counter<string>;
  private readonly websocketConnectionsTotal: Counter<string>;
  private readonly websocketMessagesTotal: Counter<string>;

  // Bandwidth metrics
  private readonly websocketBytesTotal: Counter<string>;
  private readonly sseBytesTotal: Counter<string>;
  private readonly websocketMessageSizeBytes: Histogram<string>;
  private readonly sseMessageSizeBytes: Histogram<string>;

  // Compression metrics
  private readonly websocketCompressedBytes: Counter<string>;
  private readonly websocketUncompressedBytes: Counter<string>;
  private readonly sseCompressedBytes: Counter<string>;
  private readonly sseUncompressedBytes: Counter<string>;

  // Latency metrics
  private readonly websocketMessageLatency: Histogram<string>;
  private readonly sseMessageLatency: Histogram<string>;

  // Distribution metrics
  private readonly messagesBySize: Counter<string>;
  private readonly messagesByType: Counter<string>;

  private readonly sseBytesTotalCounter: Counter<string>;

  private readonly websocketBytesSentTotal: Counter<string>;
  private readonly websocketBytesReceivedTotal: Counter<string>;

  constructor() {
    // Collect default Node.js metrics
    collectDefaultMetrics({ register });

    this.sseBytesTotalCounter = new Counter({
      name: 'sse_bytes_sent_total',
      help: 'Total bytes sent via SSE',
      labelNames: ['endpoint', 'compression'],
    });

    // HTTP request duration histogram
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
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

    this.wsMemoryUsage = new Gauge({
      name: 'websocket_memory_usage_mb',
      help: 'Current memory usage during WebSocket operations',
      labelNames: ['event'],
    });

    this.wsMessageDuration = new Histogram({
      name: 'websocket_message_duration_seconds',
      help: 'WebSocket message processing duration',
      labelNames: ['event'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
    });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    this.httpResponseSizeBytes = new Histogram({
      name: 'http_response_size_bytes',
      help: 'HTTP response size in bytes',
      labelNames: ['method', 'route', 'status_code', 'handler'],
      buckets: [100, 1024, 10240, 51200, 102400, 512000, 1048576, 5242880],
    });

    this.websocketMessagesTotal = new Counter({
      name: 'websocket_messages_total',
      help: 'Total WebSocket messages',
      labelNames: ['event', 'direction'],
    });

    this.websocketConnectionsTotal = new Counter({
      name: 'websocket_connections_total',
      help: 'Total WebSocket connections',
      labelNames: ['event', 'client_id'],
    });

    // Bandwidth metrics
    this.websocketBytesTotal = new Counter({
      name: 'websocket_bytes_total',
      help: 'Total bytes transferred via WebSocket',
      labelNames: ['direction', 'compression', 'connection_id'],
    });

    this.sseBytesTotal = new Counter({
      name: 'sse_bytes_total',
      help: 'Total bytes sent via SSE',
      labelNames: ['endpoint', 'compression', 'connection_id'],
    });

    this.websocketMessageSizeBytes = new Histogram({
      name: 'websocket_message_size_bytes',
      help: 'WebSocket message size distribution',
      labelNames: ['direction', 'compression'],
      buckets: [100, 1024, 5120, 10240, 25600, 51200],
    });

    this.sseMessageSizeBytes = new Histogram({
      name: 'sse_message_size_bytes',
      help: 'SSE message size distribution',
      labelNames: ['endpoint', 'compression'],
      buckets: [100, 1024, 5120, 10240, 25600, 51200],
    });

    // Compression metrics
    this.websocketCompressedBytes = new Counter({
      name: 'websocket_compressed_bytes_total',
      help: 'Total compressed bytes sent via WebSocket',
      labelNames: ['direction'],
    });

    this.websocketUncompressedBytes = new Counter({
      name: 'websocket_uncompressed_bytes_total',
      help: 'Total uncompressed bytes sent via WebSocket',
      labelNames: ['direction'],
    });

    this.sseCompressedBytes = new Counter({
      name: 'sse_compressed_bytes_total',
      help: 'Total compressed bytes sent via SSE',
      labelNames: ['endpoint'],
    });

    this.sseUncompressedBytes = new Counter({
      name: 'sse_uncompressed_bytes_total',
      help: 'Total uncompressed bytes sent via SSE',
      labelNames: ['endpoint'],
    });

    // Latency metrics
    this.websocketMessageLatency = new Histogram({
      name: 'websocket_message_latency_seconds',
      help: 'WebSocket message latency',
      labelNames: ['direction'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    });

    this.sseMessageLatency = new Histogram({
      name: 'sse_message_latency_seconds',
      help: 'SSE message latency',
      labelNames: ['endpoint'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    });

    // Distribution metrics
    this.messagesBySize = new Counter({
      name: 'websocket_messages_by_size_total',
      help: 'Messages by size range',
      labelNames: ['size_range', 'protocol'],
    });

    this.messagesByType = new Counter({
      name: 'websocket_messages_by_type_total',
      help: 'Messages by payload type',
      labelNames: ['payload_type', 'protocol'],
    });

    this.wsMessageCounter = new Counter({
      name: 'websocket_message_counter_total',
      help: 'Total WebSocket messages processed',
      labelNames: ['event'],
    });

    this.wsMemoryDelta = new Histogram({
      name: 'websocket_memory_delta_mb',
      help: 'WebSocket memory delta',
      labelNames: ['event'],
      buckets: [-10, -5, -1, 0, 1, 5, 10, 20, 50],
    });

    this.websocketBytesSentTotal = new Counter({
      name: 'websocket_bytes_sent_total',
      help: 'Total bytes sent via WebSocket',
      labelNames: ['direction', 'compression'],
    });

    this.websocketBytesReceivedTotal = new Counter({
      name: 'websocket_bytes_received_total',
      help: 'Total bytes received via WebSocket',
      labelNames: ['direction', 'compression'],
    });

    // Register all metrics
    register.registerMetric(this.sseBytesTotalCounter);
    register.registerMetric(this.websocketBytesSentTotal);
    register.registerMetric(this.websocketBytesReceivedTotal);
    register.registerMetric(this.httpRequestsTotal);
    register.registerMetric(this.httpRequestDuration);
    register.registerMetric(this.httpResponseSizeBytes);
    register.registerMetric(this.sseConnectionsTotal);
    register.registerMetric(this.websocketConnectionsTotal); // here
    register.registerMetric(this.websocketMessagesTotal);
    register.registerMetric(this.websocketBytesTotal);
    register.registerMetric(this.sseBytesTotal);
    register.registerMetric(this.websocketMessageSizeBytes);
    register.registerMetric(this.sseMessageSizeBytes);
    register.registerMetric(this.websocketCompressedBytes);
    register.registerMetric(this.websocketUncompressedBytes);
    register.registerMetric(this.sseCompressedBytes);
    register.registerMetric(this.sseUncompressedBytes);
    register.registerMetric(this.websocketMessageLatency);
    register.registerMetric(this.sseMessageLatency);
    register.registerMetric(this.messagesBySize);
    register.registerMetric(this.messagesByType);
    register.registerMetric(this.wsMessageCounter);
    register.registerMetric(this.memoryUsageGauge);
    register.registerMetric(this.heapUsedGauge);
    register.registerMetric(this.memoryDeltaHistogram);
    register.registerMetric(this.activeConnectionsGauge);
    register.registerMetric(this.endpointMemoryGauge);
    register.registerMetric(this.endpointMemoryDeltaHistogram);
    register.registerMetric(this.wsMemoryUsage);
    register.registerMetric(this.wsMemoryDelta);
    register.registerMetric(this.wsMessageDuration);
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
    responseSizeBytes?: number, // ADD THIS PARAMETER
  ) {
    const labels = { method, route, status_code: statusCode.toString() };

    this.httpRequestDuration.observe(labels, durationSeconds);
    this.httpRequestsTotal.inc(labels);
    this.memoryDeltaHistogram.observe(
      { method, route },
      Number(memoryDeltaMB) / 1024 / 1024,
    );

    if (responseSizeBytes) {
      this.httpResponseSizeBytes.observe(
        { method, route, status_code: statusCode.toString(), handler: 'http' },
        responseSizeBytes,
      );
    }
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
    this.websocketConnectionsTotal.inc({
      event,
      client_id: clientId.substring(0, 8),
    });
    this.wsMemoryUsage.set({ event }, memoryUsed);
  }

  recordWebSocketMessage(
    event: string,
    memoryDelta: number,
    duration: number,
    currentMemoryMB: number,
  ): void {
    this.wsMessageCounter.inc({ event });
    this.wsMemoryUsage.set({ event }, currentMemoryMB);
    this.wsMessageDuration.observe({ event }, duration);
  }

  recordHttpResponseSize(
    method: string,
    route: string,
    statusCode: number,
    sizeBytes: number,
    handler?: string,
  ) {
    this.httpResponseSizeBytes.observe(
      {
        method,
        route,
        status_code: statusCode.toString(),
        handler: handler || 'unknown',
      },
      sizeBytes,
    );
  }

  recordWebSocketMemory(
    event: string,
    memoryUsage: number,
    memoryDelta: number,
  ) {
    this.wsMemoryUsage.set({ event }, memoryUsage / 1024 / 1024);
    this.wsMemoryDelta.observe({ event }, memoryDelta / 1024 / 1024);
  }

  recordWebSocketBytes(
    direction: 'sent' | 'received',
    bytes: number,
    compression: 'none' | 'deflate' | 'gzip',
    connectionId: string,
    uncompressedBytes?: number,
    latency?: number,
  ) {
    this.websocketBytesTotal.inc(
      { direction, compression, connection_id: connectionId },
      bytes,
    );
    this.websocketMessageSizeBytes.observe({ direction, compression }, bytes);

    if (direction === 'sent') {
      this.websocketBytesSentTotal.inc({ direction, compression }, bytes);
    }

    if (direction === 'received') {
      this.websocketBytesReceivedTotal.inc({ direction, compression }, bytes);
    }

    if (uncompressedBytes) {
      this.websocketCompressedBytes.inc({ direction }, bytes);
      this.websocketUncompressedBytes.inc({ direction }, uncompressedBytes);
    }

    if (latency) {
      this.websocketMessageLatency.observe({ direction }, latency);
    }

    const sizeRange = this.getSizeRange(bytes);
    this.messagesBySize.inc({ size_range: sizeRange, protocol: 'websocket' });
  }

  recordSSEBytes(
    endpoint: string,
    bytes: number,
    compression: 'none' | 'gzip' | 'brotli',
    connectionId: string,
    uncompressedBytes?: number,
    latency?: number,
  ) {
    this.sseBytesTotal.inc(
      { endpoint, compression, connection_id: connectionId },
      bytes,
    );
    this.sseMessageSizeBytes.observe({ endpoint, compression }, bytes);
    this.sseBytesTotalCounter.inc({ endpoint, compression }, bytes);

    if (uncompressedBytes) {
      this.sseCompressedBytes.inc({ endpoint }, bytes);
      this.sseUncompressedBytes.inc({ endpoint }, uncompressedBytes);
    }

    if (latency) {
      this.sseMessageLatency.observe({ endpoint }, latency);
    }

    const sizeRange = this.getSizeRange(bytes);
    this.messagesBySize.inc({ size_range: sizeRange, protocol: 'sse' });
  }

  recordMessageByType(payloadType: string, protocol: 'websocket' | 'sse') {
    this.messagesByType.inc({ payload_type: payloadType, protocol });
  }

  recordNetworkBytes(
    protocol: string,
    direction: string,
    bytes: number,
    connectionId: string,
  ) {
    // You can use your existing websocketBytesTotal or create a new one
    this.websocketBytesTotal.inc(
      {
        direction,
        compression: 'gzip',
        connection_id: connectionId,
      },
      bytes,
    );
  }

  // Helper methods
  private getSizeRange(bytes: number): string {
    if (bytes <= 100) return '0-100B';
    if (bytes <= 1024) return '100B-1KB';
    if (bytes <= 5120) return '1-5KB';
    if (bytes <= 10240) return '5-10KB';
    if (bytes <= 25600) return '10-25KB';
    if (bytes <= 51200) return '25-50KB';
    return '50KB+';
  }

  clearMetrics() {
    register.clear();
  }
}
