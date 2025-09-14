import {
  Controller,
  Sse,
  MessageEvent,
  Logger,
  Req,
  Query,
} from '@nestjs/common';
import { Observable, Subject, interval, map, takeUntil, tap } from 'rxjs';
import { PrometheusMetricsService } from '../../profiling/prom-metrics.service';
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

  @Sse('time2')
  sendTime2(
    @Req() request: Request,
    @Query('msgs') msgs: string,
  ): Observable<MessageEvent> {
    const cleanup$ = new Subject<void>();
    const id = (request as any)?.id as string;
    SseController.cleanupMap.set(id, cleanup$);

    const int = interval(1000).pipe(
      takeUntil(cleanup$),
      map(() => {
        const payload = generateLargePayload();
        const payloadStr = JSON.stringify({ payload, ...this.podInfo });

        if (!this.isLogMessage) {
          this.logger.log(`SSE payload size: ${payloadStr.length} bytes`);
        }

        return {
          data: payloadStr,
          type: 'message',
        };
      }),
    );

    this.setupRequestCleanup(request, id);
    return int;
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
