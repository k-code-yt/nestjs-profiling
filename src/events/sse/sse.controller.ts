import {
  Controller,
  Sse,
  MessageEvent,
  Logger,
  Req,
  Query,
  Get,
  Header,
  Res,
} from '@nestjs/common';
import { Observable, Subject, interval, map, takeUntil, tap } from 'rxjs';
import { PrometheusMetricsService } from '../../profiling/prom-metrics.service';
import * as zlib from 'zlib';
import { generateLargePayload, generateNewsContent } from '../helper';
import { SSEBroadcastService } from './sse-broadcast.service';

type PodInfo = {
  podName: string;
  podIp: string;
};

type ActiveConn = {
  id: string;
  endpoint: string;
  compression: string;
  startTime: number;
  bytesWritten: number;
};

@Controller('sse')
export class SseController {
  public static cleanupMap = new Map<string, Subject<void>>();
  private activeConnections = new Map<string, ActiveConn>();
  private readonly logger = new Logger('SseController');
  private podInfo: PodInfo;

  constructor(
    private readonly metricsService: PrometheusMetricsService,
    private readonly broadcastService: SSEBroadcastService,
  ) {
    this.podInfo = {
      podName: process.env.POD_NAME || process.env.HOSTNAME || 'localhost',
      podIp: process.env.POD_IP || 'unknown',
    };
  }

  @Get('health')
  getHealth() {
    return 'hello there';
  }

  @Get('time-brotli')
  async getTimeStreamBrotli(@Res() res: Response) {
    const connectionId = this.generateConnectionId();
    this.trackConnection(connectionId, 'time-brotli', 'brotli');

    const brotliStream = zlib.createBrotliCompress({
      params: {
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_GENERIC,
        [zlib.constants.BROTLI_PARAM_QUALITY]: 1,
        [zlib.constants.BROTLI_PARAM_LGWIN]: 16,
      },
    });

    this.setupSSEHeaders(res as any, 'br');

    // Track actual compressed bytes
    let totalCompressedBytes = 0;
    let totalUncompressedBytes = 0;

    const originalWrite = (res as any).write.bind(res);
    (res as any).write = function (chunk: any, encoding?: any, callback?: any) {
      if (Buffer.isBuffer(chunk)) {
        totalCompressedBytes += chunk.length;
      } else if (typeof chunk === 'string') {
        totalCompressedBytes += Buffer.byteLength(chunk, encoding || 'utf8');
      }
      return originalWrite(chunk, encoding, callback);
    };

    brotliStream.pipe(res as any);

    let eventId = 1;
    const intervalId = setInterval(() => {
      const startTime = Date.now();
      const data = {
        time: new Date().toISOString(),
        timestamp: Date.now(),
        payload: generateLargePayload(),
        eventId: eventId,
        compressionType: 'brotli',
        ...this.podInfo,
      };

      const sseData = `event: time-update\nid: ${eventId++}\ndata: ${JSON.stringify(data)}\n\n`;
      const originalSize = Buffer.byteLength(sseData, 'utf8');
      totalUncompressedBytes += originalSize;

      const beforeCompressed = totalCompressedBytes;

      brotliStream.write(sseData, () => {
        brotliStream.flush();

        const afterCompressed = totalCompressedBytes;
        const actualCompressedSize = afterCompressed - beforeCompressed;
        const latency = (Date.now() - startTime) / 1000;

        this.metricsService.recordSSEBytes(
          'time-brotli',
          actualCompressedSize,
          'brotli',
          connectionId,
          originalSize,
          latency,
        );

        this.metricsService.recordMessageByType('large_payload', 'sse');
        this.updateConnectionBandwidth(connectionId, actualCompressedSize);
      });
    }, 1000);

    this.setupSSECleanup(res as any, intervalId, connectionId, () => {
      brotliStream.end();
      brotliStream.destroy();
    });
  }

  @Get('newsletter')
  async subscribeToNewsletter(@Res() res: Response) {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.broadcastService.addConnection(connectionId, res as any);

    // Don't return response - keep connection alive
  }

  @Sse('time-no-comp')
  sendTime1(
    @Req() request: Request,
    @Query('msgs') msgs: string,
  ): Observable<MessageEvent> {
    const cleanup$ = new Subject<void>();
    const id = (request as any)?.id as string;
    SseController.cleanupMap.set(id, cleanup$);

    const int = interval(60000 / Number(msgs)).pipe(
      takeUntil(cleanup$),
      map(() => ({
        data: JSON.stringify({
          time: new Date().toISOString(),
          timestamp: Date.now(),
          payload: generateLargePayload(),
          ...this.podInfo,
        }),
        type: 'time-update',
      })),
    );

    this.setupRequestCleanup(request, id);

    return int;
  }

  @Get('time-gzip')
  @Header('Content-Type', 'text/event-stream')
  @Header('Content-Encoding', 'gzip')
  @Header(
    'Cache-Control',
    'private, no-cache, no-store, must-revalidate, max-age=0, no-transform',
  )
  @Header('Connection', 'keep-alive')
  @Header('X-Accel-Buffering', 'no')
  async getTimeStreamCompressed2(@Res() res: Response) {
    const gzip = zlib.createGzip({
      level: 1,
      chunkSize: 256,
      windowBits: 15,
      memLevel: 8,
      strategy: zlib.constants.Z_FILTERED,
      flush: zlib.constants.Z_SYNC_FLUSH,
    });

    (res as any).setHeader('Content-Type', 'text/event-stream');
    (res as any).setHeader('Content-Encoding', 'gzip');
    (res as any).setHeader(
      'Cache-Control',
      'private, no-cache, no-store, must-revalidate, max-age=0, no-transform',
    );
    (res as any).setHeader('Connection', 'keep-alive');
    (res as any).setHeader('X-Accel-Buffering', 'no');

    gzip.pipe(res as any);

    let eventId = 1;
    const intervalId = setInterval(() => {
      const data = {
        time: new Date().toISOString(),
        timestamp: Date.now(),
        payload: generateLargePayload(),
        ...this.podInfo,
      };

      const sseData = `event: time-update\nid: ${eventId++}\ndata: ${JSON.stringify(data)}\n\n`;

      gzip.write(sseData, () => {
        gzip.flush(zlib.constants.Z_SYNC_FLUSH);
      });
    }, 1000);

    (res as any).on('close', () => {
      clearInterval(intervalId);
      gzip.end();
    });

    (res as any).on('error', (err) => {
      console.error('Response error:', err);
      clearInterval(intervalId);
      gzip.end();
    });
  }

  @Sse('time3')
  sendTime3(
    @Req() request: Request,
    @Query('msgs') msgs: string,
  ): Observable<MessageEvent> {
    const cleanup$ = new Subject<void>();
    const id = (request as any)?.id as string;
    SseController.cleanupMap.set(id, cleanup$);

    const int = interval(60000 / Number(msgs)).pipe(
      takeUntil(cleanup$),
      map(() => ({
        data: JSON.stringify({
          time: new Date().toISOString(),
          timestamp: Date.now(),
          ...this.podInfo,
        }),
        type: 'time-update',
      })),
    );

    this.setupRequestCleanup(request, id);

    return int;
  }

  private setupRequestCleanup(request: Request, clientId: string) {
    this.logger.log(`SSE client connected: ${clientId}`);
    this.metricsService.recordSSEConnection('connect', clientId);

    (request as any).on('close', () => {
      this.handleDisconnect(clientId);
    });

    (request as any).on('error', (error) => {
      this.handleDisconnect(clientId);
    });
  }

  private handleDisconnect(clientId: string) {
    let cleanup$ = SseController.cleanupMap.get(clientId);
    if (cleanup$) {
      cleanup$.next();
      cleanup$.complete();
      (cleanup$ as any) = null;
      SseController.cleanupMap.delete(clientId);
      this.metricsService.recordSSEConnection('disconnect', clientId);
    }
    this.logger.debug(`SSE client disconnected: ${clientId}`);

    if (SseController.cleanupMap.size === 0) {
      this.logger.warn(`Cleaned all SSE intervals`);
    }
  }

  private setupSSECleanup(
    res: any,
    intervalId: NodeJS.Timeout,
    connectionId: string,
    additionalCleanup?: () => void,
  ) {
    res.on('close', () => {
      clearInterval(intervalId);
      this.handleDisconnect(connectionId);
      if (additionalCleanup) additionalCleanup();
      this.logger.debug('Clean up done', 'SSE:ON_CLOSE');
    });

    res.on('error', (err) => {
      this.logger.error(err, 'SSE:ERROR');
      clearInterval(intervalId);
      this.handleDisconnect(connectionId);
      if (additionalCleanup) additionalCleanup();
    });
  }

  private updateConnectionBandwidth(connectionId: string, bytes: number) {
    const connection = this.activeConnections.get(connectionId);
    if (connection) {
      connection.bytesWritten += bytes;
    }
  }

  private trackConnection(
    id: string,
    endpoint: string,
    compression: 'none' | 'gzip' | 'brotli',
  ) {
    this.activeConnections.set(id, {
      id,
      endpoint,
      compression,
      startTime: Date.now(),
      bytesWritten: 0,
    });
  }

  private generateConnectionId(): string {
    return `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupSSEHeaders(res: any, encoding?: string) {
    res.setHeader('Content-Type', 'text/event-stream');
    if (encoding) {
      res.setHeader('Content-Encoding', encoding);
    }
    res.setHeader(
      'Cache-Control',
      'private, no-cache, no-store, must-revalidate, max-age=0, no-transform',
    );
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (encoding) {
      res.setHeader('Vary', 'Accept-Encoding');
    }
  }
}
