import {
  Controller,
  Sse,
  MessageEvent,
  Post,
  Body,
  Logger,
  Req,
} from '@nestjs/common';
import { Observable, Subject, interval, map, takeUntil, tap } from 'rxjs';
import { SseService } from './sse.service';

@Controller('sse')
export class SseController {
  public static cleanupMap = new Map<string, Subject<void>>();
  private readonly logger = new Logger('SseController');

  constructor(private readonly sseService: SseService) {}

  @Sse('time')
  sendTime(@Req() request: Request): Observable<MessageEvent> {
    const cleanup$ = new Subject<void>();
    const id = (request as any)?.id as string;
    SseController.cleanupMap.set(id, cleanup$);

    const int = interval(1000).pipe(
      takeUntil(cleanup$),
      map(() => ({
        data: JSON.stringify({
          time: new Date().toISOString(),
          timestamp: Date.now(),
        }),
        type: 'time-update',
      })),
      //   tap((event) => {
      //     this.logger.log('SSE event sent', { event });
      //   }),
    );

    this.setupRequestCleanup(request, id);

    return int;
  }

  private setupRequestCleanup(request: Request, clientId: string) {
    this.logger.log(`SSE client connected: ${clientId}`);

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
    }
    this.logger.debug(`SSE client disconnected: ${clientId}`);

    if (SseController.cleanupMap.size === 0) {
      this.logger.warn(`Cleaned all SSE intervals`);
    }
  }

  @Post('broadcast')
  broadcast(@Body() data: { message: string; channel?: string }) {
    const channel = data.channel || 'default';
    this.sseService.broadcast(channel, {
      message: data.message,
      timestamp: new Date().toISOString(),
      type: 'broadcast',
    });
    return { status: 'sent', channel };
  }
}
