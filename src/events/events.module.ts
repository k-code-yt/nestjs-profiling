import { Module } from '@nestjs/common';
import { WebsocketGateway } from './ws/ws.service';
import { SseService } from './sse/sse.service';
import { SseController } from './sse/sse.controller';
import { WSMemoryTrackingInterceptor } from './ws/ws-tracking.interceptor';

@Module({
  providers: [WebsocketGateway, SseService, WSMemoryTrackingInterceptor],
  controllers: [SseController],
})
export class EventsModule {}
