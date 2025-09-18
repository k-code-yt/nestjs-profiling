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
import { Transform } from 'stream';
import { generateLargePayload } from '../helper';

interface PodInfo {
  podName: string;
  podIp: string;
}

@Controller('sse')
export class SseController {
  public static cleanupMap = new Map<string, Subject<void>>();
  private readonly logger = new Logger('SseController');
  private podInfo: PodInfo;
  private isLogMessage: boolean = false;

  constructor(private readonly metricsService: PrometheusMetricsService) {
    this.podInfo = {
      podName: process.env.POD_NAME || process.env.HOSTNAME || 'localhost',
      podIp: process.env.POD_IP || 'unknown',
    };
  }

  @Get('health')
  getHealth() {
    return 'hello there';
  }

  @Sse('time1')
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
          ...this.podInfo,
        }),
        type: 'time-update',
      })),
    );

    this.setupRequestCleanup(request, id);

    return int;
  }

  // SSE with compression - Method 2: Using Transform stream (FIXED)
  @Get('time2')
  @Header('Content-Type', 'text/event-stream')
  @Header('Content-Encoding', 'gzip')
  @Header(
    'Cache-Control',
    'private, no-cache, no-store, must-revalidate, max-age=0, no-transform',
  )
  @Header('Connection', 'keep-alive')
  @Header('X-Accel-Buffering', 'no')
  async getTimeStreamCompressed2(@Res() res: Response) {
    // Create gzip stream with immediate flushing for streaming
    const gzip = zlib.createGzip({
      level: 1, // Lower compression for faster streaming
      chunkSize: 256, // Smaller chunks
      windowBits: 15,
      memLevel: 8,
      strategy: zlib.constants.Z_FILTERED, // Better for streaming
      flush: zlib.constants.Z_SYNC_FLUSH, // Force immediate flush
    });

    // Set headers
    (res as any).setHeader('Content-Type', 'text/event-stream');
    (res as any).setHeader('Content-Encoding', 'gzip');
    (res as any).setHeader(
      'Cache-Control',
      'private, no-cache, no-store, must-revalidate, max-age=0, no-transform',
    );
    (res as any).setHeader('Connection', 'keep-alive');
    (res as any).setHeader('X-Accel-Buffering', 'no');

    // Pipe gzip directly to response
    gzip.pipe(res as any);

    let eventId = 1;
    const intervalId = setInterval(() => {
      const data = {
        time: new Date().toISOString(),
        timestamp: Date.now(),
        payload: 'large payload data '.repeat(100), // Add some data to compress
        ...this.podInfo,
      };

      const sseData = `event: time-update\nid: ${eventId++}\ndata: ${JSON.stringify(data)}\n\n`;

      // Write to gzip and FORCE immediate flush
      gzip.write(sseData, () => {
        gzip.flush(zlib.constants.Z_SYNC_FLUSH); // Critical: Force immediate flush
      });
    }, 1000);

    // Cleanup on client disconnect
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
  @Sse('time4')
  sendTime4(
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
  @Sse('time5')
  sendTime5(
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
  @Sse('time6')
  sendTime6(
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
}
