import {
  Controller,
  Get,
  Sse,
  MessageEvent,
  Query,
  Post,
  Body,
} from '@nestjs/common';
import { Observable, interval, map } from 'rxjs';
import { SseService } from './sse.service';

@Controller('sse')
export class SseController {
  constructor(private readonly sseService: SseService) {}

  //   @Sse('events')
  //   sendEvents(@Query('channel') channel?: string): Observable<MessageEvent> {
  //     const channelName = channel || 'default';

  //     return this.sseService.getEventStream(channelName).pipe(
  //       map((data) => ({
  //         data: JSON.stringify(data),
  //         type: 'message',
  //       })),
  //     );
  //   }

  @Sse('time')
  sendTime(): Observable<MessageEvent> {
    return interval(1000).pipe(
      map(() => ({
        data: JSON.stringify({
          time: new Date().toISOString(),
          timestamp: Date.now(),
        }),
        type: 'time-update',
      })),
    );
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
