import { Module } from '@nestjs/common';
import { WebsocketGateway } from './ws/ws.service';
import { SseService } from './sse/sse.service';
import { SseController } from './sse/sse.controller';
import { WSMemoryTrackingInterceptor } from './ws/ws-tracking.interceptor';
import { ChatWebsocketGateway } from './ws/chat-room-ws.service';

@Module({
  providers: [
    ChatWebsocketGateway,
    WebsocketGateway,
    SseService,
    WSMemoryTrackingInterceptor,
  ],
  controllers: [SseController],
})
export class EventsModule {}
