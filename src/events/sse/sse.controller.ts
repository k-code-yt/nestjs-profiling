import {
  Controller,
  Sse,
  MessageEvent,
  Logger,
  Req,
  Query,
  Get,
  Res,
} from '@nestjs/common';
import { Observable, Subject, interval, map, takeUntil, tap } from 'rxjs';
import { PrometheusMetricsService } from '../../profiling/prom-metrics.service';
import * as zlib from 'zlib';
import { StaticService } from '../helper';
import { NewsletterBroadcastService } from '../newsletter-broadcast-shared.service';

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
    private readonly newsletterBroadcastService: NewsletterBroadcastService,
    private readonly staticService: StaticService,
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
    Logger.debug('New conn established', 'BROTLI');
    this.trackConnection(connectionId, 'time-brotli', 'brotli');
    this.metricsService.recordSSEConnection('connect', connectionId);

    const brotliStream = zlib.createBrotliCompress({
      params: {
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
        [zlib.constants.BROTLI_PARAM_LGWIN]: 22,
      },
    });

    this.setupSSEHeaders(res as any, 'br');
    brotliStream.pipe(res as any);

    let eventId = 1;
    const intervalId = setInterval(() => {
      const data = {
        time: new Date().toISOString(),
        timestamp: Date.now(),
        payload: this.staticService.getNewPayload(),
        eventId: eventId,
        compressionType: 'brotli',
        ...this.podInfo,
      };

      const sseData = `event: time-update\nid: ${eventId++}\ndata: ${JSON.stringify(data)}\n\n`;
      brotliStream.write(sseData, () => {
        brotliStream.flush();
      });
    }, 1000);

    this.setupSSECleanup(res as any, intervalId, connectionId, () => {
      this.metricsService.recordSSEConnection('disconnect', connectionId);
      brotliStream.end();
      brotliStream.destroy();
    });
  }

  @Sse('time-no-cmpn')
  sendTimeNoCompression(
    @Req() request: Request,
    @Query('msgs') msgs: string,
  ): Observable<MessageEvent> {
    Logger.debug('New conn established', 'NO_COMPRESSION');
    const cleanup$ = new Subject<void>();
    const id = (request as any)?.id || this.generateConnectionId();

    SseController.cleanupMap.set(id, cleanup$);

    const int = interval(60000 / Number(msgs)).pipe(
      takeUntil(cleanup$),
      map(() => ({
        data: JSON.stringify({
          time: new Date().toISOString(),
          payload: this.staticService.getNewPayload(),
          ...this.podInfo,
        }),
        type: 'time-no-cmpn',
      })),
    );

    this.setupRequestCleanup(request, id);

    return int;
  }

  @Sse('newsletter')
  sendNewsletter(
    @Req() request: Request,
    @Query('msgs') msgs: string,
    @Query('enableCompression') enableCompression: string,
  ): Observable<MessageEvent> {
    const connectionId = this.generateConnectionId();
    const cleanup$ = new Subject<void>();
    SseController.cleanupMap.set(connectionId, cleanup$);

    this.newsletterBroadcastService.addSSEConnection(
      connectionId,
      (request as any).res,
      enableCompression === 'true',
    );

    this.setupRequestCleanup(request, connectionId);
    return new Observable<MessageEvent>(() => {});
  }

  @Get('time-http-compression')
  timeStreamHTTP(
    @Req() req: Request,
    @Res() res: Response,
    @Query('msgs') msgs: string,
  ) {
    (res as any).setHeader('Content-Type', 'text/event-stream');
    (res as any).setHeader('Cache-Control', 'no-cache');
    (res as any).setHeader('Connection', 'keep-alive');
    (res as any).setHeader('Content-Encoding', 'br');

    const brotli = zlib.createBrotliCompress({
      flush: zlib.constants.BROTLI_OPERATION_FLUSH,
    });
    brotli.pipe(res as any);

    const id = this.generateConnectionId();
    const intervalMs = 60000 / Number(msgs || 60);

    const timer = setInterval(() => {
      brotli.write(
        `event: time-brotli\ndata: ${JSON.stringify({
          payload: this.staticService.getNewPayload(),
        })}\n\n`,
      );
    }, intervalMs);

    (req as any).on('close', () => {
      Logger.debug(`Cleaning up SSE connection ${id}`, 'BROTLI');
      clearInterval(timer);
      brotli.end();
    });
  }

  private setupRequestCleanup(request: Request, clientId: string) {
    this.metricsService.recordSSEConnection('connect', clientId);

    if ((request as any).destroyed || (request as any).closed) {
      this.logger.warn(`Request already closed for client: ${clientId}`);
      this.handleDisconnect(clientId);
      return;
    }

    (request as any).on('close', () => {
      this.handleDisconnect(clientId);
    });

    (request as any).on('error', (error) => {
      this.handleDisconnect(clientId);
    });
  }

  private handleDisconnect(clientId: string) {
    if (!clientId) {
      this.logger.warn('Disconnect called with undefined clientId');
      return;
    }

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
